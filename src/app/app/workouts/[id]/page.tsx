import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth';
import { logWorkout } from '../../actions';
import { SubmitButton } from '@/components/submit-button';
import type { Workout } from '@/lib/types';

export default async function LogWorkout({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, client } = await requireClient();
  const { data } = await supabase.from('workouts').select('*, workout_exercises(*, exercises(id, name, video_url, instructions))').eq('id', id).single();
  if (!data) notFound();
  const w = data as Workout;
  const exs = (w.workout_exercises ?? []).sort((a, b) => a.position - b.position);

  // Previous performance per exercise, to show "last time"
  const { data: prevSets } = await supabase.from('set_logs').select('exercise_id, set_number, reps, weight_kg, workout_logs!inner(client_id, completed_at)')
    .eq('workout_logs.client_id', client.id).in('exercise_id', exs.map((e) => e.exercise_id)).order('workout_logs(completed_at)', { ascending: false }).limit(200);
  const last = new Map<string, { kg: number | null; reps: number | null }>();
  for (const s of prevSets ?? []) if (!last.has(`${s.exercise_id}_${s.set_number}`)) last.set(`${s.exercise_id}_${s.set_number}`, { kg: s.weight_kg, reps: s.reps });

  return (
    <form action={logWorkout} className="space-y-4">
      <input type="hidden" name="workout_id" value={id} />
      <Link href="/app/workouts" className="inline-flex items-center gap-1 text-[13px] text-slate-500">‹ Training</Link>
      <h1>{w.name}</h1>
      {w.notes && <p className="text-sm text-slate-600">{w.notes}</p>}
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      {exs.map((we, i) => (
        <section key={we.id} className="card space-y-3">
          <div>
            <div className="eyebrow">Exercise {i + 1} of {exs.length}</div>
            <div className="flex items-start justify-between gap-2">
              <div className="text-base font-semibold">{we.exercises?.name}</div>
              {we.exercises?.video_url && <a href={we.exercises.video_url} target="_blank" rel="noreferrer" className="text-sm link">Demo</a>}
            </div>
            <div className="text-sm text-slate-600">{we.sets} × {we.reps}{we.target ? ` · ${we.target}` : ''}{we.rest_seconds ? ` · rest ${we.rest_seconds}s` : ''}</div>
            {(we.notes || we.exercises?.instructions) && <p className="mt-1 text-xs text-slate-500">{we.notes || we.exercises?.instructions}</p>}
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[36px_1fr_1fr_1fr] gap-2 text-2xs uppercase tracking-wide text-slate-500"><span>Set</span><span>Last time</span><span>kg</span><span>Reps</span></div>
            {Array.from({ length: we.sets }, (_, k) => k + 1).map((s) => {
              const prev = last.get(`${we.exercise_id}_${s}`);
              return (
                <div key={s} className="grid grid-cols-[36px_1fr_1fr_1fr] items-center gap-2">
                  <span className="num flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-medium text-slate-600">{s}</span>
                  <span className="num truncate text-xs text-slate-500">{prev ? `${prev.kg ?? 0}kg × ${prev.reps ?? 0}` : '—'}</span>
                  <input name={`kg_${we.id}_${s}`} type="number" inputMode="decimal" step="0.5" min="0" max="1000" placeholder={prev?.kg != null ? String(prev.kg) : 'kg'} aria-label={`Set ${s} weight in kg`} className="input num px-2 text-center" />
                  <input name={`reps_${we.id}_${s}`} type="number" inputMode="numeric" min="0" max="100" placeholder={prev?.reps != null ? String(prev.reps) : 'reps'} aria-label={`Set ${s} reps`} className="input num px-2 text-center" />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <section className="card space-y-3">
        <label className="block"><span className="label">How hard was the session? (RPE 1–10)</span>
          <input name="session_rpe" type="number" min={1} max={10} inputMode="numeric" className="input" /></label>
        <label className="block"><span className="label">Notes for your coach</span><textarea name="notes" rows={2} className="input" /></label>
      </section>
      <div className="sticky bottom-20 z-10"><SubmitButton className="btn-primary w-full py-3 shadow-pop" pendingText="Saving…">Finish workout</SubmitButton></div>
    </form>
  );
}
