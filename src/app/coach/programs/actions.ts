'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';

const s = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : v; };

export async function createProgram(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const client_id = s(formData, 'client_id');
  const name = s(formData, 'name') ?? 'New programme';
  if (client_id) await supabase.from('programs').update({ is_active: false }).eq('client_id', client_id);
  const { data, error } = await supabase.from('programs').insert({ coach_id: coach.id, client_id, name, description: s(formData, 'description') }).select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/coach/programs/${data.id}`);
}

/** Deep-copies a template programme to a client and makes it their active programme. */
export async function assignTemplate(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const templateId = String(formData.get('template_id'));
  const clientId = String(formData.get('client_id'));
  const { data: t } = await supabase.from('programs').select('name, description, workouts(name, position, notes, workout_exercises(exercise_id, position, sets, reps, target, rest_seconds, notes))').eq('id', templateId).single();
  if (!t) throw new Error('Template not found');
  await supabase.from('programs').update({ is_active: false }).eq('client_id', clientId);
  const { data: prog } = await supabase.from('programs').insert({ coach_id: coach.id, client_id: clientId, name: t.name, description: t.description }).select('id').single();
  for (const w of t.workouts ?? []) {
    const { data: nw } = await supabase.from('workouts').insert({ program_id: prog!.id, name: w.name, position: w.position, notes: w.notes }).select('id').single();
    if (w.workout_exercises?.length) {
      await supabase.from('workout_exercises').insert(w.workout_exercises.map((e) => ({ ...e, workout_id: nw!.id })));
    }
  }
  redirect(`/coach/programs/${prog!.id}`);
}

export async function updateProgram(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('program_id'));
  const active = formData.get('is_active') === 'on';
  const { data: p } = await supabase.from('programs').select('client_id').eq('id', id).single();
  if (active && p?.client_id) await supabase.from('programs').update({ is_active: false }).eq('client_id', p.client_id).neq('id', id);
  await supabase.from('programs').update({ name: s(formData, 'name') ?? 'Programme', description: s(formData, 'description'), is_active: active }).eq('id', id);
  revalidatePath(`/coach/programs/${id}`);
}

export async function deleteProgram(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('program_id'));
  await supabase.from('programs').delete().eq('id', id);
  redirect('/coach/programs');
}

export async function addWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const program_id = String(formData.get('program_id'));
  const { count } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('program_id', program_id);
  await supabase.from('workouts').insert({ program_id, name: s(formData, 'name') ?? `Day ${(count ?? 0) + 1}`, position: count ?? 0 });
  revalidatePath(`/coach/programs/${program_id}`);
}

export async function deleteWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workouts').delete().eq('id', String(formData.get('workout_id')));
  revalidatePath(`/coach/programs/${String(formData.get('program_id'))}`);
}

export async function addExerciseToWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const workout_id = String(formData.get('workout_id'));
  const { count } = await supabase.from('workout_exercises').select('id', { count: 'exact', head: true }).eq('workout_id', workout_id);
  await supabase.from('workout_exercises').insert({
    workout_id,
    exercise_id: String(formData.get('exercise_id')),
    position: count ?? 0,
    sets: Number(formData.get('sets') || 3),
    reps: s(formData, 'reps') ?? '8-12',
    target: s(formData, 'target'),
    rest_seconds: Number(formData.get('rest_seconds') || 90),
    notes: s(formData, 'notes'),
  });
  revalidatePath(`/coach/programs/${String(formData.get('program_id'))}`);
}

export async function updateWorkoutExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workout_exercises').update({
    sets: Number(formData.get('sets') || 3),
    reps: s(formData, 'reps') ?? '8-12',
    target: s(formData, 'target'),
    rest_seconds: Number(formData.get('rest_seconds') || 90),
    notes: s(formData, 'notes'),
  }).eq('id', String(formData.get('id')));
  revalidatePath(`/coach/programs/${String(formData.get('program_id'))}`);
}

export async function removeWorkoutExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from('workout_exercises').delete().eq('id', String(formData.get('id')));
  revalidatePath(`/coach/programs/${String(formData.get('program_id'))}`);
}

export async function createExercise(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const video = s(formData, 'video_url');
  if (video && !/^https:\/\//.test(video)) redirect('/coach/exercises?error=Video link must start with https://');
  await supabase.from('exercises').insert({
    coach_id: coach.id, name: s(formData, 'name') ?? 'Exercise',
    muscle_group: s(formData, 'muscle_group'), equipment: s(formData, 'equipment'),
    instructions: s(formData, 'instructions'), video_url: video,
  });
  revalidatePath('/coach/exercises');
}

export async function deleteExercise(formData: FormData) {
  const { supabase } = await requireCoach();
  const { error } = await supabase.from('exercises').delete().eq('id', String(formData.get('id')));
  if (error) redirect('/coach/exercises?error=This exercise is used in a programme, so it cannot be deleted.');
  revalidatePath('/coach/exercises');
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
  revalidatePath(`/coach/programs/${String(formData.get('program_id'))}`);
}

/** Duplicates a workout day (and its exercises) within the same programme. */
export async function duplicateWorkout(formData: FormData) {
  const { supabase } = await requireCoach();
  const programId = String(formData.get('program_id'));
  const { data: w } = await supabase.from('workouts').select('name, notes, workout_exercises(exercise_id, position, sets, reps, target, rest_seconds, notes)').eq('id', String(formData.get('workout_id'))).single();
  if (w) {
    const { count } = await supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('program_id', programId);
    const { data: nw } = await supabase.from('workouts').insert({ program_id: programId, name: `${w.name} (copy)`, notes: w.notes, position: count ?? 0 }).select('id').single();
    if (nw && w.workout_exercises?.length) await supabase.from('workout_exercises').insert(w.workout_exercises.map((e) => ({ ...e, workout_id: nw.id })));
  }
  revalidatePath(`/coach/programs/${programId}`);
}

/** Saves a client's programme as a reusable template. */
export async function saveAsTemplate(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const { data: p } = await supabase.from('programs').select('name, description, workouts(name, position, notes, workout_exercises(exercise_id, position, sets, reps, target, rest_seconds, notes))').eq('id', String(formData.get('program_id'))).single();
  if (!p) return;
  const { data: t } = await supabase.from('programs').insert({ coach_id: coach.id, client_id: null, name: `${p.name} (template)`, description: p.description }).select('id').single();
  for (const w of p.workouts ?? []) {
    const { data: nw } = await supabase.from('workouts').insert({ program_id: t!.id, name: w.name, position: w.position, notes: w.notes }).select('id').single();
    if (w.workout_exercises?.length) await supabase.from('workout_exercises').insert(w.workout_exercises.map((e) => ({ ...e, workout_id: nw!.id })));
  }
  redirect(`/coach/programs/${t!.id}`);
}
