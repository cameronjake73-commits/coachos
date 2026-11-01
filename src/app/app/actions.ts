'use server';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireClient } from '@/lib/auth';
import { recomputeRisk } from '@/lib/risk-service';
import { afterCheckinSubmitted } from '@/lib/auto-analyze';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyNewMessage } from '@/lib/notify';

const n = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : Number(v); };
const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : v.slice(0, 4000); };

export async function completeOnboarding(formData: FormData) {
  const { supabase } = await requireClient({ allowIncompleteOnboarding: true });
  if (formData.get('consent') !== 'on') redirect('/app/onboarding?error=Please give consent so your coach can use your health and fitness data.');
  const answers: Record<string, string> = {};
  for (const k of ['age', 'height_cm', 'starting_weight_kg', 'main_goal', 'training_experience', 'training_days_per_week', 'equipment', 'injuries', 'diet', 'lifestyle', 'why_now']) {
    answers[k] = String(formData.get(k) ?? '').trim().slice(0, 2000);
  }
  const { error } = await supabase.rpc('client_complete_onboarding', { answers, consent: true });
  if (error) redirect(`/app/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect('/app');
}

export async function submitCheckin(formData: FormData) {
  const { supabase, client } = await requireClient();
  const custom: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith('custom_') && String(v).trim()) custom[k.slice(7)] = String(v).trim().slice(0, 2000);

  const { data: ci, error } = await supabase.from('checkins').insert({
    client_id: client.id, coach_id: client.coach_id,
    weight_kg: n(formData, 'weight_kg'), waist_cm: n(formData, 'waist_cm'),
    sleep_hours: n(formData, 'sleep_hours'), sleep_quality: n(formData, 'sleep_quality'),
    energy: n(formData, 'energy'), stress: n(formData, 'stress'), hunger: n(formData, 'hunger'),
    training_adherence: n(formData, 'training_adherence'), nutrition_adherence: n(formData, 'nutrition_adherence'),
    avg_steps: n(formData, 'avg_steps'),
    wins: t(formData, 'wins'), struggles: t(formData, 'struggles'), questions: t(formData, 'questions'),
    custom_answers: custom,
  }).select('id').single();
  if (error || !ci) redirect(`/app/checkin?error=${encodeURIComponent(error?.message ?? 'Could not submit')}`);

  // Optional progress photos (max 3, 8MB each, images only)
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3);
  const poses = ['front', 'side', 'back'];
  for (const [i, file] of files.entries()) {
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) continue;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `${client.id}/${ci.id}-${poses[i] ?? i}.${ext}`;
    const { error: upErr } = await supabase.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: true });
    if (!upErr) await supabase.from('progress_photos').insert({ client_id: client.id, checkin_id: ci.id, storage_path: path, pose: poses[i] ?? 'other' });
  }

  after(() => afterCheckinSubmitted(ci.id, client.id, client.coach_id));
  redirect('/app/checkin?submitted=1');
}

export async function logWorkout(formData: FormData) {
  const { supabase, client } = await requireClient();
  const workoutId = String(formData.get('workout_id'));
  const { data: w } = await supabase.from('workouts').select('name, workout_exercises(id, exercise_id, sets, exercises(name))').eq('id', workoutId).single();
  if (!w) redirect('/app/workouts');
  const { data: log, error } = await supabase.from('workout_logs').insert({
    client_id: client.id, workout_id: workoutId, workout_name: w.name,
    session_rpe: n(formData, 'session_rpe'), notes: t(formData, 'notes'),
  }).select('id').single();
  if (error || !log) redirect(`/app/workouts/${workoutId}?error=${encodeURIComponent(error?.message ?? 'Could not save')}`);

  const sets: { workout_log_id: string; exercise_id: string; exercise_name: string; set_number: number; reps: number | null; weight_kg: number | null }[] = [];
  for (const we of w.workout_exercises ?? []) {
    const name = (we.exercises as unknown as { name: string } | null)?.name ?? 'Exercise';
    for (let s = 1; s <= we.sets; s++) {
      const reps = n(formData, `reps_${we.id}_${s}`), weight = n(formData, `kg_${we.id}_${s}`);
      if (reps == null && weight == null) continue;
      sets.push({ workout_log_id: log.id, exercise_id: we.exercise_id, exercise_name: name, set_number: s, reps, weight_kg: weight });
    }
  }
  if (sets.length) await supabase.from('set_logs').insert(sets);
  after(() => recomputeRisk(createAdminClient(), client.id));
  redirect('/app/workouts?logged=1');
}

export async function sendClientMessage(formData: FormData) {
  const { supabase, client } = await requireClient();
  const body = String(formData.get('body') ?? '').trim().slice(0, 5000);
  if (body) {
    await supabase.from('messages').insert({ client_id: client.id, coach_id: client.coach_id, sender: 'client', body });
    after(() => notifyNewMessage(client.id, 'client'));
  }
  revalidatePath('/app/messages');
}
