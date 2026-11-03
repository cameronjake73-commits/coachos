import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeCheckin, draftMessage, slimCheckin, summariseClient, weeklyBrief } from '@/lib/ai';
import { describePerformance, trainingPerformance } from '@/lib/performance';
import { checkinStatus } from '@/lib/coaching';
import { attentionScore } from '@/lib/dashboard-data';
import type { Checkin, Client, Coach } from '@/lib/types';

/** Server-only helpers that gather real data, call the AI and store the result. */
const DAILY_AI_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_COACH || 150);
const DAY = 86_400_000;

async function assertQuota(supabase: SupabaseClient, coachId: string) {
  const { count } = await supabase.from('ai_events').select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId).gte('created_at', new Date(Date.now() - DAY).toISOString());
  if ((count ?? 0) >= DAILY_AI_LIMIT) throw new Error(`Daily AI limit reached (${DAILY_AI_LIMIT} in 24 hours). Try again later.`);
}

async function logEvent(supabase: SupabaseClient, coachId: string, clientId: string | null, kind: string, model: string) {
  await supabase.from('ai_events').insert({ coach_id: coachId, client_id: clientId, kind, model });
}

async function plannedPerWeek(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase.from('programs').select('workouts(id)').eq('client_id', clientId).eq('is_active', true);
  return Math.min(7, (data ?? []).reduce((n, p: { workouts: { id: string }[] }) => n + (p.workouts?.length ?? 0), 0));
}

async function recentCoachText(supabase: SupabaseClient, coachId: string) {
  const { data } = await supabase.from('checkins').select('coach_reply').eq('coach_id', coachId).not('coach_reply', 'is', null).order('replied_at', { ascending: false }).limit(3);
  return (data ?? []).map((r) => r.coach_reply as string);
}

export async function analyzeAndSave(supabase: SupabaseClient, coach: Coach, checkinId: string) {
  await assertQuota(supabase, coach.id);
  const { data: ci } = await supabase.from('checkins').select('*').eq('id', checkinId).single();
  if (!ci) throw new Error('Check-in not found');
  const current = ci as Checkin;
  const [{ data: client }, { data: prev }, perf, planned, replies] = await Promise.all([
    supabase.from('clients').select('full_name, goal, target_weight_kg').eq('id', current.client_id).single(),
    supabase.from('checkins').select('*').eq('client_id', current.client_id).lt('submitted_at', current.submitted_at).order('submitted_at', { ascending: false }).limit(4),
    trainingPerformance(supabase, current.client_id, current.submitted_at),
    plannedPerWeek(supabase, current.client_id),
    recentCoachText(supabase, coach.id),
  ]);
  const labels = Object.fromEntries((coach.checkin_questions ?? []).map((q) => [q.id, q.label]));
  const analysis = await analyzeCheckin({
    firstName: (client?.full_name ?? 'there').split(' ')[0],
    goal: client?.goal ?? null,
    targetWeightKg: client?.target_weight_kg ?? null,
    current,
    previous: (prev ?? []) as Checkin[],
    workoutsInWeek: perf.sessions,
    plannedPerWeek: planned,
    performance: describePerformance(perf.exercises),
    coachVoice: coach.ai_voice_notes,
    recentCoachReplies: replies,
    customQuestionLabels: labels,
  });
  await supabase.from('checkins').update({ ai_analysis: analysis }).eq('id', checkinId);
  await logEvent(supabase, coach.id, current.client_id, 'checkin_analysis', analysis.model);
  return analysis;
}

export async function summariseAndSave(supabase: SupabaseClient, coach: Coach, clientId: string) {
  await assertQuota(supabase, coach.id);
  const { data: c } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (!c) throw new Error('Client not found');
  const client = c as Client;
  const since = new Date(Date.now() - 56 * DAY).toISOString();
  const [{ data: cis }, { data: logs }, planned] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(12),
    supabase.from('workout_logs').select('completed_at').eq('client_id', clientId).gte('completed_at', since),
    plannedPerWeek(supabase, clientId),
  ]);
  const checkins = ((cis ?? []) as Checkin[]).reverse();
  const perWeek = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * DAY, start = end - 7 * DAY;
    return (logs ?? []).filter((l) => { const t = new Date(l.completed_at).getTime(); return t > start && t <= end; }).length;
  });
  const status = checkinStatus(client, checkins[checkins.length - 1]?.submitted_at, coach.checkin_day);
  const summary = await summariseClient({
    firstName: client.full_name.split(' ')[0], goal: client.goal, targetWeightKg: client.target_weight_kg,
    weeksCoached: Math.max(0, Math.floor((Date.now() - new Date(client.start_date ?? client.created_at).getTime()) / (7 * DAY))),
    checkins: checkins.map(slimCheckin), workoutsPerWeek: perWeek, plannedPerWeek: planned,
    missedCheckins: status.state === 'missed' ? status.missedCount : 0,
  });
  await supabase.from('clients').update({ ai_summary: summary }).eq('id', clientId);
  await logEvent(supabase, coach.id, clientId, 'client_summary', summary.model);
  return summary;
}

export async function draftAndSave(supabase: SupabaseClient, coach: Coach, clientId: string, coachFirstName: string) {
  await assertQuota(supabase, coach.id);
  const { data: c } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (!c) throw new Error('Client not found');
  const client = c as Client;
  const [{ data: last }, { data: lastMsg }, { data: coachMsgs }] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('messages').select('created_at').eq('client_id', clientId).eq('sender', 'client').order('created_at', { ascending: false }).limit(1),
    supabase.from('messages').select('body').eq('coach_id', coach.id).eq('sender', 'coach').order('created_at', { ascending: false }).limit(3),
  ]);
  const lastCi = (last?.[0] ?? null) as Checkin | null;
  const days = (d?: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null);
  const status = checkinStatus(client, lastCi?.submitted_at, coach.checkin_day);
  const reasons = [...client.risk_reasons];
  if (status.state === 'missed') reasons.unshift(status.missedCount > 1 ? `Missed ${status.missedCount} weekly check-ins` : 'Missed this week\'s check-in');
  const message = await draftMessage({
    firstName: client.full_name.split(' ')[0], coachFirstName, reasons,
    lastCheckin: lastCi ? slimCheckin(lastCi) : null,
    daysSinceLastCheckin: days(lastCi?.submitted_at), daysSinceLastMessage: days(lastMsg?.[0]?.created_at),
    paymentOverdue: client.payment_status === 'overdue',
    coachVoice: coach.ai_voice_notes, recentCoachMessages: (coachMsgs ?? []).map((m) => (m.body as string).replace(/^Check-in feedback:\s*/, '')),
  });
  await supabase.from('clients').update({ ai_draft: message, ai_draft_at: new Date().toISOString() }).eq('id', clientId);
  await logEvent(supabase, coach.id, clientId, 'outreach_draft', process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5');
  return message;
}

export async function briefAndSave(supabase: SupabaseClient, coach: Coach, d: {
  active: Client[]; statuses: Map<string, ReturnType<typeof checkinStatus>>; pendingReview: unknown[]; renewals: Client[]; overdue: Client[]; mrr: number;
}) {
  await assertQuota(supabase, coach.id);
  const ranked = d.active.map((c) => ({ c, s: d.statuses.get(c.id), score: attentionScore(c, d.statuses.get(c.id)) }))
    .sort((a, b) => b.score - a.score).slice(0, 12);
  const refToClient = new Map<string, { id: string; name: string }>();
  const clients = ranked.map(({ c, s }, i) => {
    const ref = `c${i + 1}`;
    refToClient.set(ref, { id: c.id, name: c.full_name });
    const facts = [...c.risk_reasons];
    if (s?.state === 'missed') facts.unshift(s.missedCount > 1 ? `Missed ${s.missedCount} check-ins in a row` : 'Missed this week\'s check-in');
    if (s?.state === 'submitted') facts.push('Checked in this week');
    if (c.renewal_date) facts.push(`Renewal date ${c.renewal_date}`);
    if (c.monthly_fee) facts.push(`Pays £${c.monthly_fee}/month`);
    return { ref, first_name: c.full_name.split(' ')[0], facts };
  });
  const brief = await weeklyBrief({
    totals: {
      active_clients: d.active.length, checkins_to_review: d.pendingReview.length,
      missed_checkins: [...d.statuses.values()].filter((s) => s.state === 'missed').length,
      renewals_next_14_days: d.renewals.length, overdue_payments: d.overdue.length, monthly_revenue_gbp: d.mrr,
    },
    clients,
  }, refToClient);
  await supabase.from('coaches').update({ ai_brief: brief }).eq('id', coach.id);
  await logEvent(supabase, coach.id, null, 'weekly_brief', brief.model);
  return brief;
}
