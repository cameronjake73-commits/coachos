'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

const s = (f: FormData, k: string, max = 500) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : v.slice(0, max); };
const int = (f: FormData, k: string, def: number, min: number, max: number) => {
  const n = Math.round(Number(f.get(k)));
  return Number.isFinite(n) && String(f.get(k) ?? '').trim() !== '' ? Math.min(max, Math.max(min, n)) : def;
};
const path = (f: FormData) => `/coach/programs/${String(f.get('program_id'))}`;

type ProgTree = { name: string; description: string | null; workouts: { name: string; position: number; notes: string | null; workout_exercises: { exercise_id: string; position: number; sets: number; reps: string; target: string | null; rest_seconds: number | null; notes: string | null }[] }[] };
const TREE = 'name, description, workouts(name, position, notes, workout_exercises(exercise_id, position, sets, reps, target, rest_seconds, notes))';

/** Deep-copies a programme (days + exercises). Returns the new programme id. */
async function copyProgram(supabase: SupabaseClient, coachId: string, sourceId: string, clientId: string | null, name?: string) {
  const { data: t } = await supabase.from('programs').select(TREE).eq('id', sourceId).single();
  if (!t) throw new Error('Programme not found');
  const src = t as unknown as ProgTree;
  if (clientId) await supabase.from('programs').update({ is_active: false }).eq('client_id', clientId);
  const { data: prog, error } = await supabase.from('programs').insert({ coach_id: coachId, client_id: clientId, name: name ?? src.name, description: src.description }).select('id').single();
  if (error || !prog) throw new Error(error?.message ?? 'Could not copy programme');
  for (const w of src.workouts ?? []) {
    const { data: nw } = await supabase.from('workouts').insert({ program_id: prog.id, name: w.name, position: w.position, notes: w.notes }).select('id').single();
    if (nw && w.workout_exercises?.length) await supabase.from('workout_exercises').insert(w.workout_exercises.map((e) => ({ ...e, workout_id: nw.id })));
  }
  return prog.id as string;
}

export async function createProgram(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const client_id = s(formData, 'client_id');
  const name = s(formData, 'name', 120) ?? 'New programme';
  if (client_id) await supabase.from('programs').update({ is_active: false }).eq('client_id', client_id);
  const { data, error } = await supabase.from('programs').insert({ coach_id: coach.id, client_id, name, description: s(formData, 'description', 2000) }).select('id').single();
  if (error) redirect(`/coach/programs?error=${encodeURIComponent(error.message)}`);
  await supabase.from('workouts').insert({ program_id: data.id, name: 'Day 1', position: 0 });
  redirect(`/coach/programs/${data.id}`);
}

/** Copies a template to a client and makes it their active programme. */
export async function assignTemplate(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = await copyProgram(supabase, coach.id, String(formData.get('template_id')), String(formData.get('client_id')));
  redirect(`/coach/programs/${id}?flash=assigned`);
}

export async function duplicateProgram(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const { data: p } = await supabase.from('programs').select('name').eq('id', String(formData.get('program_id'))).single();
  const id = await copyProgram(supabase, coach.id, String(formData.get('program_id')), null, `${p?.name ?? 'Programme'} (copy)`);
  redirect(`/coach/programs/${id}?flash=duplicated`);
}

export async function saveAsTemplate(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const { data: p } = await supabase.from('programs').select('name').eq('id', String(formData.get('program_id'))).single();
  const id = await copyProgram(supabase, coach.id, String(formData.get('program_id')), null, `${p?.name ?? 'Programme'} (template)`);
  redirect(`/coach/programs/${id}?flash=duplicated`);
}

/** Autosaved from the builder: name, description and (for client programmes) active state. */
export async function updateProgram(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('program_id'));
  const patch: Record<string, unknown> = { name: s(formData, 'name', 120) ?? 'Programme', description: s(formData, 'description', 2000) };
  if (formData.has('is_active_present')) {
    const active = formData.get('is_active') === 'on';
    const { data: p } = await supabase.from('programs').select('client_id').eq('id', id).single();
    if (active && p?.client_id) await supabase.from('programs').update({ is_active: false }).eq('client_id', p.client_id).neq('id', id);
    patch.is_active = active;
  }
  await supabase.from('programs').update(patch).eq('id', id);
}

export async function deleteProgram(formData: FormData) {
  const { supabase } = await requireCoach();
  const { data: p } = await supabase.from('programs').select('client_id').eq('id', String(formData.get('program_id'))).single();
  await supabase.from('programs').delete().eq('id', String(formData.get('program_id')));
  redirect(p?.client_id ? `/coach/clients/${p.client_id}?tab=training&flash=deleted` : '/coach/programs?flash=deleted');
}

export async function addWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const program_id = String(formData.get('program_id'));
  const { data: rows } = await supabase.from('workouts').select('position').eq('program_id', program_id).order('position', { ascending: false }).limit(1);
  const { count } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('program_id', program_id);
  await supabase.from('workouts').insert({ program_id, name: s(formData, 'name', 120) ?? `Day ${(count ?? 0) + 1}`, position: (rows?.[0]?.position ?? -1) + 1 });
  revalidatePath(path(formData));
}

/** Autosaved: day name and notes. */
export async function updateWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workouts').update({ name: s(formData, 'name', 120) ?? 'Workout', notes: s(formData, 'notes', 2000) }).eq('id', String(formData.get('workout_id')));
}

export async function deleteWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workouts').delete().eq('id', String(formData.get('workout_id')));
  revalidatePath(path(formData));
}

export async function moveWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const programId = String(formData.get('program_id'));
  const id = String(formData.get('workout_id'));
  const dir = String(formData.get('dir')) === 'up' ? -1 : 1;
  const { data: rows } = await supabase.from('workouts').select('id, position').eq('program_id', programId).order('position').order('id');
  const list = rows ?? [];
  const i = list.findIndex((r) => r.id === id), j = i + dir;
  if (i >= 0 && j >= 0 && j < list.length) {
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((r, k) => supabase.from('workouts').update({ position: k }).eq('id', r.id)));
  }
  revalidatePath(path(formData));
}

export async function duplicateWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const programId = String(formData.get('program_id'));
  const { data: w } = await supabase.from('workouts').select('name, notes, workout_exercises(exercise_id, position, sets, reps, target, rest_seconds, notes)').eq('id', String(formData.get('workout_id'))).single();
  if (w) {
    const { data: rows } = await supabase.from('workouts').select('position').eq('program_id', programId).order('position', { ascending: false }).limit(1);
    const { data: nw } = await supabase.from('workouts').insert({ program_id: programId, name: `${w.name} (copy)`, notes: w.notes, position: (rows?.[0]?.position ?? 0) + 1 }).select('id').single();
    if (nw && w.workout_exercises?.length) await supabase.from('workout_exercises').insert(w.workout_exercises.map((e) => ({ ...e, workout_id: nw.id })));
  }
  revalidatePath(path(formData));
}

export async function addExerciseToWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const workout_id = String(formData.get('workout_id'));
  const { data: rows } = await supabase.from('workout_exercises').select('position').eq('workout_id', workout_id).order('position', { ascending: false }).limit(1);
  await supabase.from('workout_exercises').insert({
    workout_id,
    exercise_id: String(formData.get('exercise_id')),
    position: (rows?.[0]?.position ?? -1) + 1,
    sets: int(formData, 'sets', 3, 1, 20),
    reps: s(formData, 'reps', 20) ?? '8-12',
    target: s(formData, 'target', 40),
    rest_seconds: int(formData, 'rest_seconds', 90, 0, 900),
    notes: s(formData, 'notes', 500),
  });
  revalidatePath(path(formData));
}

/** Autosaved from each exercise row. */
export async function updateWorkoutExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workout_exercises').update({
    sets: int(formData, 'sets', 3, 1, 20),
    reps: s(formData, 'reps', 20) ?? '8-12',
    target: s(formData, 'target', 40),
    rest_seconds: int(formData, 'rest_seconds', 90, 0, 900),
    notes: s(formData, 'notes', 500),
  }).eq('id', String(formData.get('id')));
}

export async function removeWorkoutExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workout_exercises').delete().eq('id', String(formData.get('id')));
  revalidatePath(path(formData));
}

/** Moves an exercise up or down within its workout by swapping positions with its neighbour. */
export async function moveWorkoutExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('id'));
  const dir = String(formData.get('dir')) === 'up' ? -1 : 1;
  const { data: me } = await supabase.from('workout_exercises').select('id, workout_id').eq('id', id).single();
  if (me) {
    const { data: rows } = await supabase.from('workout_exercises').select('id, position').eq('workout_id', me.workout_id).order('position').order('id');
    const list = rows ?? [];
    const i = list.findIndex((r) => r.id === id), j = i + dir;
    if (i >= 0 && j >= 0 && j < list.length) {
      [list[i], list[j]] = [list[j], list[i]];
      await Promise.all(list.map((r, k) => supabase.from('workout_exercises').update({ position: k }).eq('id', r.id)));
    }
  }
  revalidatePath(path(formData));
}

/* ------------------------------------------------------------------ exercise library */

const exerciseFields = (formData: FormData) => {
  const video = s(formData, 'video_url', 500);
  return {
    name: s(formData, 'name', 120), muscle_group: s(formData, 'muscle_group', 60), equipment: s(formData, 'equipment', 60),
    instructions: s(formData, 'instructions', 3000), video_url: video,
    error: video && !/^https:\/\//.test(video) ? 'Video link must start with https://' : null,
  };
};

export async function createExercise(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const { error, ...f } = exerciseFields(formData);
  if (!f.name) redirect('/coach/exercises?error=Give the exercise a name');
  if (error) redirect(`/coach/exercises?error=${encodeURIComponent(error)}`);
  await supabase.from('exercises').insert({ coach_id: coach.id, ...f });
  redirect('/coach/exercises?flash=added');
}

export async function updateExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('id'));
  const { error, ...f } = exerciseFields(formData);
  if (!f.name) redirect(`/coach/exercises/${id}?error=Give the exercise a name`);
  if (error) redirect(`/coach/exercises/${id}?error=${encodeURIComponent(error)}`);
  await supabase.from('exercises').update(f).eq('id', id);
  redirect(`/coach/exercises?flash=saved`);
}

export async function deleteExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  const { error } = await supabase.from('exercises').delete().eq('id', String(formData.get('id')));
  if (error) redirect('/coach/exercises?error=This exercise is used in a programme, so it can\'t be deleted. Remove it from programmes first.');
  redirect('/coach/exercises?flash=deleted');
}
