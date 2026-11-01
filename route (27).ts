import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { recomputeRisk } from '@/lib/risk-service';
import { emails, sendEmail } from '@/lib/email';

export const maxDuration = 300;

/**
 * Daily job (vercel.json, 08:00 UTC):
 *  1. Re-score every active client's risk (catches people who've gone quiet).
 *  2. Email check-in reminders on each coach's check-in day.
 *  3. Email each coach a morning digest when something needs attention.
 * Safe to run twice: send timestamps prevent duplicate emails.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const todayUk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(new Date()));
  const stats = { scored: 0, reminders: 0, digests: 0 };

  const { data: coaches } = await admin.from('coaches')
    .select('id, business_name, checkin_day, email_digest, last_digest_at, plan, trial_ends_at, subscription_status, profiles(full_name, email)');

  for (const coach of coaches ?? []) {
    const lapsed = coach.plan === 'trial' ? new Date(coach.trial_ends_at).getTime() < now : !['active', 'trialing', 'past_due'].includes(coach.subscription_status);
    if (lapsed) continue;
    const profile = coach.profiles as unknown as { full_name: string | null; email: string | null } | null;
    const coachName = coach.business_name || profile?.full_name || 'Your coach';

    const { data: clients } = await admin.from('clients')
      .select('id, full_name, email, user_id, status, email_reminders, reminder_last_sent_at').eq('coach_id', coach.id).in('status', ['active', 'paused']);

    // 1. Risk
    for (const c of clients ?? []) { await recomputeRisk(admin, c.id); stats.scored++; }

    // 2. Reminders
    if (coach.checkin_day === todayUk) {
      for (const c of clients ?? []) {
        if (c.status !== 'active' || !c.user_id || !c.email_reminders) continue;
        if (c.reminder_last_sent_at && c.reminder_last_sent_at > hoursAgo(20)) continue;
        const { count } = await admin.from('checkins').select('id', { count: 'exact', head: true }).eq('client_id', c.id).gte('submitted_at', hoursAgo(5 * 24));
        if (count) continue;
        const e = emails.checkinReminder({ clientName: c.full_name, coachName });
        if (await sendEmail(c.email, e.subject, e.html)) stats.reminders++;
        await admin.from('clients').update({ reminder_last_sent_at: new Date().toISOString() }).eq('id', c.id);
      }
    }

    // 3. Digest
    if (coach.email_digest && profile?.email && !(coach.last_digest_at && coach.last_digest_at > hoursAgo(20))) {
      const [{ count: pending }, { data: risky }, { data: lastCis }] = await Promise.all([
        admin.from('checkins').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).eq('status', 'submitted'),
        admin.from('clients').select('full_name, risk_reasons').eq('coach_id', coach.id).eq('status', 'active').eq('risk_level', 'high').order('risk_score', { ascending: false }),
        admin.from('checkins').select('client_id, submitted_at').eq('coach_id', coach.id).gte('submitted_at', hoursAgo(8 * 24)),
      ]);
      const recent = new Set((lastCis ?? []).map((r) => r.client_id));
      const overdue = (clients ?? []).filter((c) => c.status === 'active' && c.user_id && !recent.has(c.id)).length;
      if ((pending ?? 0) > 0 || (risky?.length ?? 0) > 0) {
        const e = emails.coachDigest({
          coachName: profile.full_name || 'Coach', pending: pending ?? 0, overdue,
          atRisk: (risky ?? []).map((r) => ({ name: r.full_name, reason: (r.risk_reasons as string[])[0] ?? 'Engagement dropping' })),
        });
        if (await sendEmail(profile.email, e.subject, e.html)) stats.digests++;
        await admin.from('coaches').update({ last_digest_at: new Date().toISOString() }).eq('id', coach.id);
      }
    }
  }
  return NextResponse.json(stats);
}
