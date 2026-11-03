import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from '@/lib/types';
import { pctChange } from '@/lib/format';
import { checkinCycle, checkinStatus, type CheckinStatus } from '@/lib/coaching';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface WeeklyCheckin { id: string; client_id: string; submitted_at: string; training_adherence: number | null; nutrition_adherence: number | null; status: string }

/** Average engagement (mean of training + nutrition adherence) per week, oldest first. */
export function weeklyEngagement(checkins: WeeklyCheckin[], weeks: number, offsetWeeks = 0): (number | null)[] {
  const out: (number | null)[] = [];
  const now = Date.now();
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now - (w + offsetWeeks) * WEEK, start = end - WEEK;
    const vals = checkins.filter((c) => { const t = new Date(c.submitted_at).getTime(); return t > start && t <= end; })
      .map((c) => [c.training_adherence, c.nutrition_adherence].filter((v): v is number => v != null))
      .filter((a) => a.length).map((a) => a.reduce((x, y) => x + y, 0) / a.length);
    out.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
  }
  return out;
}

/** Monthly recurring revenue at the end of each of the last N months, from client fees and start/archive dates. */
export function revenueByMonth(clients: Client[], months: number) {
  const now = new Date();
  const out: { label: string; value: number }[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const end = m === 0 ? now : new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59);
    const value = clients
      .filter((c) => c.status !== 'invited' && c.payment_status !== 'cancelled')
      .filter((c) => new Date(c.start_date ?? c.created_at).getTime() <= end.getTime())
      .filter((c) => c.status !== 'archived' || (c.archived_at && new Date(c.archived_at).getTime() > end.getTime()))
      .reduce((s, c) => s + Number(c.monthly_fee || 0), 0);
    out.push({ label: end.toLocaleDateString('en-GB', { month: 'short' }), value });
  }
  return out;
}

export function recommendedAction(c: Client, status?: CheckinStatus) {
  const r = c.risk_reasons.join(' ').toLowerCase();
  if (c.payment_status === 'overdue') return 'Send a friendly payment reminder and ask how they are finding the plan.';
  if (status?.state === 'missed' || r.includes('no check-in') || r.includes('missed') || r.includes('never')) return 'Send a short personal message and consider simplifying their plan for a week.';
  if (r.includes('renewal')) return 'Check in before their renewal and remind them of the progress they have made.';
  if (r.includes('adherence')) return 'Ask what has changed this week and offer a lighter week to rebuild momentum.';
  if (r.includes('workouts')) return 'Check whether the training days still fit their schedule and adjust if needed.';
  if (r.includes('stress') || r.includes('sleep') || r.includes('energy')) return 'Ask how they are coping outside training before changing anything.';
  return 'Send a quick personal message to see how they are getting on.';
}

/** Template fallback used when AI isn't connected. */
export function draftOutreach(c: Client, coachFirstName: string, status?: CheckinStatus) {
  const first = c.full_name.split(' ')[0];
  const r = c.risk_reasons.join(' ').toLowerCase();
  const opener = c.payment_status === 'overdue'
    ? `Just a quick heads-up that this month's payment hasn't come through yet. No stress, these things happen!`
    : status?.state === 'missed' || r.includes('check-in') || r.includes('missed')
      ? `I noticed I haven't had a check-in from you for a little while and wanted to make sure you're doing ok.`
      : r.includes('adherence') || r.includes('workouts')
        ? `I've noticed the last couple of weeks have been tougher, which is completely normal.`
        : `Just checking in to see how everything's going.`;
  return `Hey ${first}, ${opener}\n\nHow are things at the moment? If life is busy, we can simplify the plan for a week or two. Even 2-3 sessions and hitting your protein keeps the momentum going.\n\nLet me know what would help most.\n\n- ${coachFirstName}`;
}

/** Ranks clients by how much they need the coach's attention right now. */
export function attentionScore(c: Client, s?: CheckinStatus) {
  let score = c.risk_score;
  if (s?.state === 'missed') score += 12 * Math.min(s.missedCount, 3);
  if (c.payment_status === 'overdue') score += 25;
  if (c.renewal_date) {
    const until = (new Date(c.renewal_date).getTime() - Date.now()) / DAY;
    if (until >= 0 && until <= 10 && c.risk_level !== 'low') score += 15;
  }
  return score;
}

export async function loadDashboard(supabase: SupabaseClient, coachId: string, checkinDay = 0) {
  const since = new Date(Date.now() - 12 * WEEK).toISOString();
  const [{ data: clientsRaw }, { data: cis }, { data: lastAll }, { data: logs }, { data: msgs }, { data: progs }, { data: nut }, { data: unreadRows }] = await Promise.all([
    supabase.from('clients').select('*').eq('coach_id', coachId).order('risk_score', { ascending: false }),
    supabase.from('checkins').select('id, client_id, submitted_at, training_adherence, nutrition_adherence, status').eq('coach_id', coachId).gte('submitted_at', since).order('submitted_at', { ascending: false }),
    supabase.from('checkins').select('client_id, submitted_at').eq('coach_id', coachId).order('submitted_at', { ascending: false }).limit(3000),
    supabase.from('workout_logs').select('id, client_id, workout_name, completed_at, clients!inner(coach_id, full_name)').eq('clients.coach_id', coachId).order('completed_at', { ascending: false }).limit(8),
    supabase.from('messages').select('id, client_id, created_at, sender, read_at, clients(full_name)').eq('coach_id', coachId).eq('sender', 'client').order('created_at', { ascending: false }).limit(8),
    supabase.from('programs').select('client_id').eq('coach_id', coachId).eq('is_active', true).not('client_id', 'is', null),
    supabase.from('nutrition_targets').select('client_id, clients!inner(coach_id)').eq('clients.coach_id', coachId),
    supabase.from('messages').select('client_id').eq('coach_id', coachId).eq('sender', 'client').is('read_at', null),
  ]);
  const all = (clientsRaw ?? []) as Client[];
  const clients = all.filter((c) => c.status !== 'archived');
  const active = clients.filter((c) => c.status === 'active');
  const invited = clients.filter((c) => c.status === 'invited');
  const checkins = (cis ?? []) as WeeklyCheckin[];
  const now = Date.now();

  const lastBy = new Map<string, string>();
  for (const r of lastAll ?? []) if (!lastBy.has(r.client_id)) lastBy.set(r.client_id, r.submitted_at);
  const statuses = new Map<string, CheckinStatus>();
  for (const c of active) statuses.set(c.id, checkinStatus(c, lastBy.get(c.id), checkinDay));
  const cycle = checkinCycle(checkinDay);

  const eligible = active.filter((c) => statuses.get(c.id)?.state !== 'new');
  const submitted = eligible.filter((c) => statuses.get(c.id)?.state === 'submitted');
  const missed = eligible.filter((c) => statuses.get(c.id)?.state === 'missed');
  const awaiting = eligible.filter((c) => statuses.get(c.id)?.state === 'due');
  const pendingReview = checkins.filter((c) => c.status === 'submitted');

  const withProgramme = new Set((progs ?? []).map((p) => p.client_id as string));
  const withNutrition = new Set((nut ?? []).map((n) => n.client_id as string));
  const unreadBy = new Map<string, number>();
  for (const m of unreadRows ?? []) unreadBy.set(m.client_id, (unreadBy.get(m.client_id) ?? 0) + 1);

  const paying = active.filter((c) => c.payment_status !== 'cancelled' && Number(c.monthly_fee || 0) > 0);
  const mrr = paying.reduce((s, c) => s + Number(c.monthly_fee || 0), 0);
  const revenue = revenueByMonth(all, 6);
  const atRisk = active.filter((c) => c.risk_level === 'high');
  const revenueAtRisk = atRisk.reduce((s, c) => s + Number(c.monthly_fee || 0), 0);
  const overdue = active.filter((c) => c.payment_status === 'overdue');

  const renewals = active
    .filter((c) => { const n = c.renewal_date ? (new Date(c.renewal_date).getTime() - now) / DAY : null; return n != null && n > -1 && n <= 14; })
    .sort((a, b) => (a.renewal_date! < b.renewal_date! ? -1 : 1));

  const attention = active
    .map((c) => ({ c, s: statuses.get(c.id), score: attentionScore(c, statuses.get(c.id)) }))
    .filter((x) => x.c.risk_level !== 'low' || x.s?.state === 'missed' || x.c.payment_status === 'overdue')
    .sort((a, b) => b.score - a.score);

  const activePrev = active.filter((c) => new Date(c.start_date ?? c.created_at).getTime() <= now - 30 * DAY).length;
  const kept = all.filter((c) => c.status !== 'invited');
  const retention = kept.length ? Math.round((kept.filter((c) => c.status !== 'archived' && c.payment_status !== 'cancelled').length / kept.length) * 100) : null;

  const nameOf = (id: string) => all.find((c) => c.id === id)?.full_name ?? 'A client';
  const activity = [
    ...checkins.slice(0, 10).map((c) => ({ kind: 'checkin' as const, at: c.submitted_at, text: `${nameOf(c.client_id)} submitted a check-in`, href: `/coach/checkins/${c.id}` })),
    ...(logs ?? []).map((l) => ({ kind: 'workout' as const, at: l.completed_at, text: `${(l.clients as unknown as { full_name: string }).full_name} logged ${l.workout_name}`, href: `/coach/clients/${l.client_id}?tab=training` })),
    ...(msgs ?? []).map((m) => ({ kind: 'message' as const, at: m.created_at, text: `${(m.clients as unknown as { full_name: string } | null)?.full_name ?? 'A client'} sent a message`, href: `/coach/messages?c=${m.client_id}` })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 7);

  return {
    clients, active, invited, checkins, activity, revenue, mrr, statuses, lastBy, cycle, renewals, attention, overdue,
    missed, awaiting, submitted, eligible, pendingReview, withProgramme, withNutrition, unreadBy, paying, atRisk, revenueAtRisk,
    stats: {
      active: active.length, activeDelta: pctChange(active.length, activePrev),
      retention,
      completion: eligible.length ? Math.round((submitted.length / eligible.length) * 100) : null,
      mrr, mrrDelta: pctChange(revenue[revenue.length - 1]?.value ?? 0, revenue[revenue.length - 4]?.value ?? 0),
    },
    engagement: { current: weeklyEngagement(checkins, 4), previous: weeklyEngagement(checkins, 4, 4) },
  };
}
