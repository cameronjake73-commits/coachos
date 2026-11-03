import type { SupabaseClient } from '@supabase/supabase-js';
import { e1rm } from '@/lib/coaching';

const DAY = 86_400_000;

export interface ExercisePerformance {
  exercise: string;
  thisWeek: { kg: number; reps: number } | null;
  before: { kg: number; reps: number } | null;
  /** % change in estimated 1RM between the best set this week and the best set in the 3 weeks before. */
  change: number | null;
}

/** Training done in the 7 days up to `until`, compared with the 3 weeks before. Real logged sets only. */
export async function trainingPerformance(supabase: SupabaseClient, clientId: string, until: string) {
  const end = new Date(until).getTime();
  const weekStart = end - 7 * DAY, from = end - 28 * DAY;
  const { data } = await supabase.from('workout_logs')
    .select('id, workout_name, completed_at, session_rpe, set_logs(exercise_name, reps, weight_kg)')
    .eq('client_id', clientId).gte('completed_at', new Date(from).toISOString()).lte('completed_at', new Date(end).toISOString())
    .order('completed_at', { ascending: false });
  const logs = data ?? [];
  const thisWeekLogs = logs.filter((l) => new Date(l.completed_at).getTime() > weekStart);

  const best = new Map<string, { now?: { kg: number; reps: number; e: number }; before?: { kg: number; reps: number; e: number } }>();
  for (const l of logs) {
    const recent = new Date(l.completed_at).getTime() > weekStart;
    for (const s of (l.set_logs ?? []) as { exercise_name: string; reps: number | null; weight_kg: number | null }[]) {
      const e = e1rm(s.weight_kg == null ? null : Number(s.weight_kg), s.reps);
      if (e == null) continue;
      const slot = best.get(s.exercise_name) ?? {};
      const key = recent ? 'now' : 'before';
      if (!slot[key] || e > slot[key]!.e) slot[key] = { kg: Number(s.weight_kg), reps: s.reps!, e };
      best.set(s.exercise_name, slot);
    }
  }
  const exercises: ExercisePerformance[] = [...best.entries()]
    .filter(([, v]) => v.now)
    .map(([exercise, v]) => ({
      exercise,
      thisWeek: v.now ? { kg: v.now.kg, reps: v.now.reps } : null,
      before: v.before ? { kg: v.before.kg, reps: v.before.reps } : null,
      change: v.now && v.before ? Math.round(((v.now.e - v.before.e) / v.before.e) * 1000) / 10 : null,
    }))
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));

  const rpes = thisWeekLogs.map((l) => l.session_rpe).filter((x): x is number => x != null);
  return {
    sessions: thisWeekLogs.length,
    sessionNames: thisWeekLogs.map((l) => l.workout_name),
    avgRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    exercises,
  };
}

export const describePerformance = (p: ExercisePerformance[]) => p.slice(0, 8).map((x) =>
  `${x.exercise}: best set ${x.thisWeek!.kg}kg x ${x.thisWeek!.reps} this week${x.before ? ` (previous 3 weeks best ${x.before.kg}kg x ${x.before.reps}, estimated strength ${x.change! >= 0 ? '+' : ''}${x.change}%)` : ' (no earlier sets to compare)'}`);
