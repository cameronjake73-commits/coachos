import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, Empty } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { addExerciseToWorkout, addWorkout, deleteProgram, deleteWorkout, duplicateWorkout, moveWorkoutExercise, removeWorkoutExercise, saveAsTemplate, updateProgram, updateWorkoutExercise } from '../actions';
import type { Exercise, Workout } from '@/lib/types';

export default async function ProgramBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireCoach();
  const [{ data: program }, { data: exs }] = await Promise.all([
    supabase.from('programs').select('*, clients(id, full_name), workouts(*, workout_exercises(*, exercises(id, name, muscle_group, video_url, instructions)))').eq('id', id).single(),
    supabase.from('exercises').select('id, name, muscle_group, coach_id').order('name'),
  ]);
  if (!program) notFound();
  const workouts = ((program.workouts ?? []) as Workout[]).sort((a, b) => a.position - b.position);
  workouts.forEach((w) => w.workout_exercises?.sort((a, b) => a.position - b.position));
  const exercises = (exs ?? []) as Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'coach_id'>[];
  const groups = [...new Set(exercises.map((e) => e.muscle_group || 'Other'))].sort();
  const client = program.clients as { id: string; full_name: string } | null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href={client ? `/coach/clients/${client.id}?tab=training` : '/coach/programs'} className="text-sm text-slate-500 hover:underline">← {client ? client.full_name : 'Programmes'}</Link>
        <div className="mt-1 flex items-center gap-2">
          <h1>{program.name}</h1>
          {client ? <Badge tone="blue">for {client.full_name}</Badge> : <Badge>template</Badge>}
        </div>
      </div>

      <Card>
        <form action={updateProgram} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
          <input type="hidden" name="program_id" value={id} />
          <label><span className="label">Name</span><input name="name" defaultValue={program.name} className="input" /></label>
          <label><span className="label">Description / notes for client</span><input name="description" defaultValue={program.description ?? ''} className="input" /></label>
          {client ? <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={program.is_active} /> Active</label> : <input type="hidden" name="is_active" value="on" />}
          <SubmitButton className="btn-secondary">Save</SubmitButton>
        </form>
      </Card>

      {workouts.length === 0 && <Empty>Add the first workout day below.</Empty>}

      {workouts.map((w) => (
        <Card key={w.id} title={w.name} action={
          <form className="flex gap-3"><input type="hidden" name="workout_id" value={w.id} /><input type="hidden" name="program_id" value={id} />
            <button formAction={duplicateWorkout} className="text-sm link">Duplicate</button>
            <button formAction={deleteWorkout} className="text-sm text-red-600 hover:underline">Remove day</button></form>
        }>
          <div className="space-y-2">
            {(w.workout_exercises ?? []).map((we, i) => (
              <form key={we.id} action={updateWorkoutExercise} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_70px_90px_110px_90px_auto_auto]">
                <input type="hidden" name="id" value={we.id} /><input type="hidden" name="program_id" value={id} />
                <div className="col-span-2 sm:col-span-1"><div className="flex items-center gap-1 text-xs text-slate-400">{i + 1}.
                  <button formAction={moveWorkoutExercise} name="dir" value="up" disabled={i === 0} className="rounded px-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">▲</button>
                  <button formAction={moveWorkoutExercise} name="dir" value="down" disabled={i === (w.workout_exercises?.length ?? 0) - 1} className="rounded px-1 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">▼</button></div><div className="font-medium">{we.exercises?.name}</div><div className="text-xs text-slate-500">{we.exercises?.muscle_group}</div></div>
                <label><span className="text-xs text-slate-500">Sets</span><input name="sets" type="number" min={1} max={20} defaultValue={we.sets} className="input" /></label>
                <label><span className="text-xs text-slate-500">Reps</span><input name="reps" defaultValue={we.reps} className="input" /></label>
                <label><span className="text-xs text-slate-500">Target</span><input name="target" defaultValue={we.target ?? ''} placeholder="RPE 8" className="input" /></label>
                <label><span className="text-xs text-slate-500">Rest (s)</span><input name="rest_seconds" type="number" defaultValue={we.rest_seconds ?? 90} className="input" /></label>
                <SubmitButton className="btn-secondary">Save</SubmitButton>
                <button formAction={removeWorkoutExercise} className="btn text-red-600 hover:bg-red-50">✕</button>
                <label className="col-span-2 sm:col-span-7"><span className="text-xs text-slate-500">Coaching notes</span><input name="notes" defaultValue={we.notes ?? ''} className="input" /></label>
              </form>
            ))}
          </div>
          <form action={addExerciseToWorkout} className="mt-3 grid grid-cols-2 items-end gap-2 border-t pt-3 sm:grid-cols-[2fr_70px_90px_110px_auto]">
            <input type="hidden" name="workout_id" value={w.id} /><input type="hidden" name="program_id" value={id} />
            <label className="col-span-2 sm:col-span-1"><span className="text-xs text-slate-500">Add exercise</span>
              <select name="exercise_id" required className="input">
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {exercises.filter((e) => (e.muscle_group || 'Other') === g).map((e) => <option key={e.id} value={e.id}>{e.name}{e.coach_id ? ' (yours)' : ''}</option>)}
                  </optgroup>
                ))}
              </select></label>
            <label><span className="text-xs text-slate-500">Sets</span><input name="sets" type="number" defaultValue={3} className="input" /></label>
            <label><span className="text-xs text-slate-500">Reps</span><input name="reps" defaultValue="8-12" className="input" /></label>
            <label><span className="text-xs text-slate-500">Target</span><input name="target" placeholder="RPE 8" className="input" /></label>
            <SubmitButton className="btn-primary">Add</SubmitButton>
          </form>
        </Card>
      ))}

      <Card>
        <form action={addWorkout} className="flex gap-2">
          <input type="hidden" name="program_id" value={id} />
          <input name="name" placeholder={`e.g. Day ${workouts.length + 1}: Upper`} className="input" />
          <SubmitButton className="btn-primary whitespace-nowrap">Add workout day</SubmitButton>
        </form>
      </Card>

      <form className="flex justify-end gap-4">
        <input type="hidden" name="program_id" value={id} />
        {client && <button formAction={saveAsTemplate} className="text-sm link">Save as template</button>}
        <button formAction={deleteProgram} className="text-sm text-red-600 hover:underline">Delete programme</button>
      </form>
    </div>
  );
}
