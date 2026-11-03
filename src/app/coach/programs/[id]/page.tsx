import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { AutoSaveForm, ConfirmButton } from '@/components/form-bits';
import { ExercisePicker } from '@/components/exercise-picker';
import {
  addExerciseToWorkout, addWorkout, assignTemplate, deleteProgram, deleteWorkout, duplicateProgram, duplicateWorkout,
  moveWorkout, moveWorkoutExercise, removeWorkoutExercise, saveAsTemplate, updateProgram, updateWorkout, updateWorkoutExercise,
} from '../actions';
import type { Exercise, Workout } from '@/lib/types';

const iconBtn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 md:h-8 md:w-8';

export default async function ProgramBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, coach } = await requireCoach();
  const [{ data: program }, { data: exs }, { data: clients }] = await Promise.all([
    supabase.from('programs').select('*, clients(id, full_name), workouts(*, workout_exercises(*, exercises(id, name, muscle_group, video_url, instructions)))').eq('id', id).maybeSingle(),
    supabase.from('exercises').select('id, name, muscle_group, equipment, coach_id').order('name'),
    supabase.from('clients').select('id, full_name').eq('coach_id', coach.id).in('status', ['active', 'invited', 'paused']).order('full_name'),
  ]);
  if (!program) notFound();
  const workouts = ((program.workouts ?? []) as Workout[]).sort((a, b) => a.position - b.position);
  workouts.forEach((w) => w.workout_exercises?.sort((a, b) => a.position - b.position));
  const exercises = ((exs ?? []) as (Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment' | 'coach_id'>)[]).map((e) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, equipment: e.equipment, mine: !!e.coach_id }));
  const client = program.clients as { id: string; full_name: string } | null;
  const totalExercises = workouts.reduce((n, w) => n + (w.workout_exercises?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={client ? `/coach/clients/${client.id}?tab=training` : '/coach/programs'} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] text-slate-500 hover:text-slate-800">
        <Icon name="chevronLeft" className="h-4 w-4" />{client ? client.full_name : 'Programmes'}
      </Link>

      <h1 className="sr-only">{program.name}</h1>
      <Card>
        <AutoSaveForm action={updateProgram} className="space-y-3">
          <input type="hidden" name="program_id" value={id} />
          <div className="flex flex-wrap items-center gap-2">
            {client ? <Badge tone="blue">For {client.full_name}</Badge> : <Badge tone="brand">Template</Badge>}
            <span className="text-xs text-slate-500">{workouts.length} day{workouts.length === 1 ? '' : 's'} · {totalExercises} exercise{totalExercises === 1 ? '' : 's'}</span>
          </div>
          <label className="sr-only" htmlFor="pname">Programme name</label>
          <input id="pname" name="name" defaultValue={program.name} maxLength={120} className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 text-xl font-semibold tracking-tight text-slate-900 outline-none transition hover:border-slate-200 focus:border-brand-500 md:text-2xl" />
          <label className="label" htmlFor="pdesc">Notes for the client</label>
          <textarea id="pdesc" name="description" rows={2} maxLength={2000} defaultValue={program.description ?? ''} placeholder="e.g. Aim to add a little weight or a rep each week. Rest 2-3 min on compounds." className="input" />
          {client && (
            <label className="flex items-center gap-2 text-sm">
              <input type="hidden" name="is_active_present" value="1" />
              <input type="checkbox" name="is_active" defaultChecked={program.is_active} /> Active programme (shown in {client.full_name.split(' ')[0]}&apos;s app)
            </label>
          )}
        </AutoSaveForm>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          {!client && (clients?.length ? (
            <form action={assignTemplate} className="flex w-full gap-2 sm:w-auto">
              <input type="hidden" name="template_id" value={id} />
              <label className="sr-only" htmlFor="assign">Assign to client</label>
              <select id="assign" name="client_id" required className="input sm:w-56" defaultValue=""><option value="" disabled>Assign to a client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
              <SubmitButton className="btn-primary" pendingText="Assigning…">Assign</SubmitButton>
            </form>
          ) : <span className="text-[13px] text-slate-500">Add a client to assign this template.</span>)}
          <form className="flex flex-wrap gap-2 sm:ml-auto">
            <input type="hidden" name="program_id" value={id} />
            {client
              ? <ConfirmButton formAction={saveAsTemplate} message="Save a copy of this programme as a reusable template?" className="btn-secondary btn-sm"><Icon name="copy" className="h-4 w-4" />Save as template</ConfirmButton>
              : <ConfirmButton formAction={duplicateProgram} message="Make a copy of this template?" className="btn-secondary btn-sm"><Icon name="copy" className="h-4 w-4" />Duplicate</ConfirmButton>}
            <ConfirmButton formAction={deleteProgram} message={`Delete “${program.name}”? ${client ? 'It will be removed from their app. Their workout history is kept.' : 'Client programmes made from it are not affected.'}`} className="btn-ghost btn-sm text-red-700"><Icon name="trash" className="h-4 w-4" />Delete</ConfirmButton>
          </form>
        </div>
      </Card>

      {workouts.length === 0 && <Card><EmptyState icon="programs" title="No training days yet">Add the first day below, then add exercises to it.</EmptyState></Card>}

      <ol className="space-y-4">
        {workouts.map((w, wi) => (
          <li key={w.id} className="card space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              <span className="num mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-300">{wi + 1}</span>
              <AutoSaveForm action={updateWorkout} className="order-3 w-full min-w-0 space-y-1.5 sm:order-2 sm:w-auto sm:flex-1">
                <input type="hidden" name="workout_id" value={w.id} />
                <label className="sr-only" htmlFor={`wn-${w.id}`}>Day name</label>
                <input id={`wn-${w.id}`} name="name" defaultValue={w.name} maxLength={120} className="-mx-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-brand-500" />
                <label className="sr-only" htmlFor={`wnotes-${w.id}`}>Day notes</label>
                <input id={`wnotes-${w.id}`} name="notes" defaultValue={w.notes ?? ''} maxLength={2000} placeholder="Add notes for this day (warm-up, focus…)" className="-mx-2 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] text-slate-600 outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-brand-500" />
              </AutoSaveForm>
              <div className="order-2 ml-auto flex shrink-0 items-center sm:order-3">
                {(['up', 'down'] as const).map((dir) => (
                  <form key={dir} action={moveWorkout}>
                    <input type="hidden" name="workout_id" value={w.id} /><input type="hidden" name="program_id" value={id} /><input type="hidden" name="dir" value={dir} />
                    <button disabled={dir === 'up' ? wi === 0 : wi === workouts.length - 1} className={iconBtn} aria-label={`Move day ${dir}`}><Icon name={dir === 'up' ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" /></button>
                  </form>
                ))}
                <form>
                  <input type="hidden" name="workout_id" value={w.id} /><input type="hidden" name="program_id" value={id} />
                  <button formAction={duplicateWorkout} className={iconBtn} aria-label="Duplicate day" title="Duplicate day"><Icon name="copy" className="h-4 w-4" /></button>
                  <ConfirmButton formAction={deleteWorkout} message={`Remove “${w.name}” and its exercises?`} className={iconBtn}><Icon name="trash" className="h-4 w-4" /><span className="sr-only">Remove day</span></ConfirmButton>
                </form>
              </div>
            </div>

            <ul className="space-y-2">
              {(w.workout_exercises ?? []).map((we, i) => (
                <li key={we.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="num w-5 shrink-0 text-xs text-slate-500">{i + 1}.</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{we.exercises?.name}</div><div className="truncate text-xs text-slate-500">{we.exercises?.muscle_group}</div></div>
                    <div className="flex shrink-0 items-center">
                      {(['up', 'down'] as const).map((dir) => (
                        <form key={dir} action={moveWorkoutExercise}>
                          <input type="hidden" name="id" value={we.id} /><input type="hidden" name="program_id" value={id} /><input type="hidden" name="dir" value={dir} />
                          <button disabled={dir === 'up' ? i === 0 : i === (w.workout_exercises?.length ?? 0) - 1} className={iconBtn} aria-label={`Move ${we.exercises?.name} ${dir}`}><Icon name={dir === 'up' ? 'chevronUp' : 'chevronDown'} className="h-4 w-4" /></button>
                        </form>
                      ))}
                      <form action={removeWorkoutExercise}>
                        <input type="hidden" name="id" value={we.id} /><input type="hidden" name="program_id" value={id} />
                        <button className={`${iconBtn} hover:text-red-700`} aria-label={`Remove ${we.exercises?.name}`}><Icon name="x" className="h-4 w-4" /></button>
                      </form>
                    </div>
                  </div>
                  <AutoSaveForm action={updateWorkoutExercise} className="mt-2.5 grid grid-cols-4 items-end gap-2 lg:grid-cols-[70px_90px_110px_90px_1fr_auto]">
                    <input type="hidden" name="id" value={we.id} />
                    <label className="col-span-1"><span className="text-2xs text-slate-500">Sets</span><input name="sets" type="number" min={1} max={20} inputMode="numeric" defaultValue={we.sets} className="input num px-2" /></label>
                    <label className="col-span-1"><span className="text-2xs text-slate-500">Reps</span><input name="reps" maxLength={20} defaultValue={we.reps} className="input num px-2" /></label>
                    <label className="col-span-1"><span className="text-2xs text-slate-500">Target</span><input name="target" maxLength={40} defaultValue={we.target ?? ''} placeholder="RPE 8" className="input px-2" /></label>
                    <label className="col-span-1"><span className="text-2xs text-slate-500">Rest (s)</span><input name="rest_seconds" type="number" min={0} max={900} step={15} inputMode="numeric" defaultValue={we.rest_seconds ?? 90} className="input num px-2" /></label>
                    <label className="col-span-4 lg:col-span-1"><span className="text-2xs text-slate-500">Coaching notes</span><input name="notes" maxLength={500} defaultValue={we.notes ?? ''} placeholder="Cues, tempo, alternatives…" className="input" /></label>
                  </AutoSaveForm>
                </li>
              ))}
            </ul>
            <ExercisePicker exercises={exercises} hidden={{ workout_id: w.id, program_id: id }} action={addExerciseToWorkout} />
          </li>
        ))}
      </ol>

      <form action={addWorkout} className="card flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="program_id" value={id} />
        <label className="sr-only" htmlFor="newday">New day name</label>
        <input id="newday" name="name" maxLength={120} placeholder={`Day ${workouts.length + 1}: e.g. Upper body`} className="input" />
        <SubmitButton className="btn-primary" pendingText="Adding…"><Icon name="plus" className="h-4 w-4" />Add training day</SubmitButton>
      </form>
      <p className="text-center text-xs text-slate-500">Changes save automatically.</p>
    </div>
  );
}
