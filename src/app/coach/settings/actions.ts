'use server';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { MEASUREMENTS, type CheckinQuestion } from '@/lib/types';

const TYPES = ['text', 'scale', 'yesno'];

export async function saveSettings(formData: FormData) {
  const { supabase, coach, user } = await requireCoach();
  let questions: CheckinQuestion[] = coach.checkin_questions ?? [];
  try {
    const raw = JSON.parse(String(formData.get('checkin_questions_json') ?? '[]')) as CheckinQuestion[];
    questions = raw.filter((q) => q && typeof q.label === 'string' && q.label.trim()).slice(0, 10)
      .map((q, i) => ({ id: /^[a-z0-9]{1,24}$/i.test(String(q.id)) ? String(q.id) : `q${i + 1}`, label: q.label.trim().slice(0, 200), type: TYPES.includes(String(q.type)) ? q.type : 'text' }));
  } catch { /* keep existing */ }
  const measurements = MEASUREMENTS.map((m) => m.id).filter((id) => formData.get(`m_${id}`) === 'on');
  const day = Number(formData.get('checkin_day') ?? 0);

  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 120);
  if (!fullName) redirect('/coach/settings?error=Your name can\'t be empty');
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('coaches').update({
      business_name: String(formData.get('business_name') ?? '').trim().slice(0, 120) || null,
      ai_voice_notes: String(formData.get('ai_voice_notes') ?? '').trim().slice(0, 2000) || null,
      checkin_day: Number.isInteger(day) && day >= 0 && day <= 6 ? day : 0,
      checkin_questions: questions,
      checkin_measurements: measurements,
      email_digest: formData.get('email_digest') === 'on',
    }).eq('id', coach.id),
    supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id),
  ]);
  if (e1 || e2) redirect(`/coach/settings?error=${encodeURIComponent((e1 ?? e2)!.message)}`);
  redirect('/coach/settings?flash=saved');
}

/** Deletes the coach account and ALL their clients' data (GDPR erasure), cancelling any Stripe subscription first. */
export async function deleteCoachAccount(formData: FormData) {
  const { createAdminClient } = await import('@/lib/supabase/server');
  const { supabase, coach } = await requireCoach();
  if (String(formData.get('confirm')).trim() !== 'DELETE MY ACCOUNT') redirect('/coach/settings?error=Type DELETE MY ACCOUNT to confirm');
  const admin = createAdminClient();

  if (coach.stripe_subscription_id) {
    const { getStripe } = await import('@/lib/stripe');
    try { await getStripe().subscriptions.cancel(coach.stripe_subscription_id); } catch (e) { console.error('stripe cancel failed', e); }
  }
  const { data: clients } = await admin.from('clients').select('id, user_id').eq('coach_id', coach.id);
  const ids = (clients ?? []).map((c) => c.id);
  if (ids.length) {
    const { data: photos } = await admin.from('progress_photos').select('storage_path').in('client_id', ids);
    for (let i = 0; i < (photos?.length ?? 0); i += 100) {
      await admin.storage.from('progress-photos').remove(photos!.slice(i, i + 100).map((p) => p.storage_path));
    }
  }
  for (const c of clients ?? []) if (c.user_id) await admin.auth.admin.deleteUser(c.user_id);
  await supabase.auth.signOut();
  await admin.auth.admin.deleteUser(coach.id); // cascades to profile, coach, clients and all related rows
  redirect('/?deleted=1');
}
