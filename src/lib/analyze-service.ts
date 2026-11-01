import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeCheckin } from '@/lib/ai';
import type { Checkin, Coach } from '@/lib/types';

/** Builds the AI input from a check-in + history, runs the analysis and stores it. Server-only. */
const DAILY_AI_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_COACH || 150);

export async function analyzeAndSave(supabase: SupabaseClient, coach: Coach, checkinId: string) {
  const { count: used } = await supabase.from('ai_events').select('id', { count: 'exact', head: true })
    .eq('coach_id', coach.id).gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((used ?? 0) >= DAILY_AI_LIMIT) throw new Error(`Daily AI limit reached (${DAILY_AI_LIMIT} analyses in 24 hours). Try again later.`);
  const { data: ci } = await supabase.from('checkins').select('*').eq('id', checkinId).single();
  if (!ci) throw new Error('Check-in not found');
  const current = ci as Checkin;
  const since14 = new Date(new Date(current.submitted_at).getTime() - 14 * 864e5).toISOString();
  const [{ data: client }, { data: prev }, { count: logs }, { data: progs }, { data: replies }] = await Promise.all([
    supabase.from('clients').select('full_name, goal').eq('id', current.client_id).single(),
    supabase.from('checkins').select('*').eq('client_id', current.client_id).lt('submitted_at', current.submitted_at).order('submitted_at', { ascending: false }).limit(4),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', current.client_id).gte('completed_at', since14).lte('completed_at', current.submitted_at),
    supabase.from('programs').select('workouts(id)').eq('client_id', current.client_id).eq('is_active', true),
    supabase.from('checkins').select('coach_reply').eq('coach_id', coach.id).not('coach_reply', 'is', null).order('replied_at', { ascending: false }).limit(3),
  ]);
  const labels = Object.fromEntries((coach.checkin_questions ?? []).map((q) => [q.id, q.label]));
  const analysis = await analyzeCheckin({
    firstName: (client?.full_name ?? 'there').split(' ')[0],
    goal: client?.goal ?? null,
    current,
    previous: (prev ?? []) as Checkin[],
    workoutsLast14Days: logs ?? 0,
    plannedPerWeek: (progs ?? []).reduce((n, p: { workouts: { id: string }[] }) => n + (p.workouts?.length ?? 0), 0),
    coachVoice: coach.ai_voice_notes,
    recentCoachReplies: (replies ?? []).map((r) => r.coach_reply as string),
    customQuestionLabels: labels,
  });
  await supabase.from('checkins').update({ ai_analysis: analysis }).eq('id', checkinId);
  await supabase.from('ai_events').insert({ coach_id: coach.id, client_id: current.client_id, kind: 'checkin_analysis', model: analysis.model });
  return analysis;
}
