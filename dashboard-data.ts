import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from '@/lib/types';
import { pctChange } from '@/lib/format';

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

/** Estimated monthly recurring revenue at the end of each of the last N months, from client fees and start dates. */
export function revenueByMonth(clients: Client[], months: number) {
  const now = new Date();
  const out: { label: string; value: number }[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const end = m === 0 ? now : new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59);
    const value = clients
      .filter((c) => c.status !== 'invited' && c.payment_status !== 'cancelled' && c.status !== 'archived')
      .filter((c) => new Date(c.start_date ?? c.created_at).getTime() <= end.getTime())
      .reduce((s, c) => s + Number(c.monthly_fee || 0), 0);
    out.push({ label: end.toLocaleDateString('en-GB', { month: 'short' }).slice(0, 3), value });
  }
  return out;
}

export function recommendedAction(c: Client) {
  const r = c.risk_reasons.join(' ').toLowerCase();
  if (c.payment_status === 'overdue') return 'Send a friendly payment reminder and ask how they are finding the plan.';
  if (r.includes('no check-in') || r.includes('missed') || r.includes('never')) return 'Send a friendly check-in message and consider simplifying their plan for a week.';
  if (r.includes('renewal')) return 'Check in before their renewal and remind them of the progress they have made.';
  if (r.includes('adherence')) return 'Ask what has changed this week and offer a lighter "maintenance" week to rebuild momentum.';
  if (r.includes('workouts')) return 'Check whether the training days still fit their schedule and adjust if needed.';
  return 'Send a quick personal message to see how they are getting on.';
}

export function draftOutreach(c: Client, coachFirstName: string) {
  const first = c.full_name.split(' ')[0];
  const r = c.risk_reasons.join(' ').toLowerCase();
  const opener = c.payment_status === 'overdue'
    ? `Just a quick heads-up that this month's payment hasn't come through yet. No stress, these things happen!`
    : r.includes('check-in') || r.includes('missed')
      ? `I noticed I haven't had a check-in from you for a little while and wanted to make sure you're doing ok.`
      : r.includes('adherence') || r.includes('workouts')
        ? `I've noticed the last couple of weeks have been tougher, which is completely normal.`
        : `Just checking in to see how everything's going.`;
  return `Hey ${first}, ${opener}\n\nHow are things at the moment? If life is busy, we can simplify the plan for a week or two. Even 2-3 sessions and hitting your protein keeps the momentum going.\n\nLet me know what would help most.\n\n- ${coachFirstName}`;
}

export async function loadDashboard(supabase: SupabaseClient, coachId: string) {
  const since = new Date(Date.now() - 8 * WEEK).toISOString();
  const [{ data: clientsRaw }, { data: cis }, { data: logs }, { data: msgs }] = await Promise.all([
    supabase.from('clients').select('*').eq('coach_id', coachId).order('risk_score', { ascending: false }),
    supabase.from('checkins').select('id, client_id, submitted_at, training_adherence, nutrition_adherence, status').eq('coach_id', coachId).gte('submitted_at', since).order('submitted_at', { ascending: false }),
    supabase.from('workout_logs').select('id, client_id, workout_name, completed_at, clients!inner(coach_id, full_name)').eq('clients.coach_id', coachId).order('completed_at', { ascending: false }).limit(8),
    supabase.from('messages').select('id, client_id, created_at, sender, clients(full_name)').eq('coach_id', coachId).eq('sender', 'client').order('created_at', { ascending: false }).limit(8),
  ]);
  const all = (clientsRaw ?? []) as Client[];
  const clients = all.filter((c) => c.status !== 'archived');
  const active = clients.filter((c) => c.status === 'active');
  const checkins = (cis ?? []) as WeeklyCheckin[];
  const now = Date.now();
  const startOf = (c: Client) => new Date(c.start_date ?? c.created_at).getTime();

  const activePrev = active.filter((c) => startOf(c) <= now - 30 * DAY).length;
  const kept = all.filter((c) => c.status !== 'invited');
  const retention = kept.length ? Math.round((kept.filter((c) => c.status !== 'archived' && c.payment_status !== 'cancelled').length / kept.length) * 100) : null;

  const checkedThisWeek = new Set(checkins.filter((c) => new Date(c.submitted_at).getTime() > now - WEEK).map((c) => c.client_id));
  const checkedLastWeek = new Set(checkins.filter((c) => { const t = new Date(c.submitted_at).getTime(); return t > now - 2 * WEEK && t <= now - WEEK; }).map((c) => c.client_id));
  const mrr = active.filter((c) => c.payment_status !== 'cancelled').reduce((s, c) => s + Number(c.monthly_fee || 0), 0);
  const revenue = revenueByMonth(clients, 6);

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.full_name ?? 'A client';
  const activity = [
    ...checkins.filter((c) => c.status === 'submitted' || new Date(c.submitted_at).getTime() > now - 3 * DAY).slice(0, 8)
      .map((c) => ({ kind: 'checkin' as const, at: c.submitted_at, text: `${nameOf(c.client_id)} completed their weekly check-in`, href: `/coach/checkins/${c.id}` })),
    ...(logs ?? []).map((l) => ({ kind: 'workout' as const, at: l.completed_at, text: `${(l.clients as unknown as { full_name: string }).full_name} logged ${l.workout_name}`, href: `/coach/clients/${l.client_id}?tab=training` })),
    ...(msgs ?? []).map((m) => ({ kind: 'message' as const, at: m.created_at, text: `New message from ${(m.clients as unknown as { full_name: string } | null)?.full_name ?? 'a client'}`, href: `/coach/clients/${m.client_id}?tab=messages` })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 5);

  return {
    clients, active, checkins, activity, revenue, mrr,
    stats: {
      active: active.length, activeDelta: pctChange(active.length, activePrev),
      retention,
      checkedThisWeek: checkedThisWeek.size, checkinDelta: pctChange(checkedThisWeek.size, checkedLastWeek.size),
      mrr, mrrDelta: pctChange(revenue[revenue.length - 1]?.value ?? 0, revenue[revenue.length - 4]?.value ?? 0),
    },
    engagement: { current: weeklyEngagement(checkins, 4), previous: weeklyEngagement(checkins, 4, 4) },
  };
}
