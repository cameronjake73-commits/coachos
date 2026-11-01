'use server';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';

export async function saveSettings(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const questions = String(formData.get('checkin_questions') ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10)
    .map((label, i) => ({ id: `q${i + 1}`, label }));
  await supabase.from('coaches').update({
    business_name: String(formData.get('business_name') ?? '').trim() || null,
    ai_voice_notes: String(formData.get('ai_voice_notes') ?? '').trim() || null,
    checkin_day: Number(formData.get('checkin_day') ?? 0),
    checkin_questions: questions,
    email_digest: formData.get('email_digest') === 'on',
  }).eq('id', coach.id);
  revalidatePath('/coach/settings');
}

/** Deletes the coach account and ALL their clients' data (GDPR erasure), cancelling any Stripe subscription first. */
export async function deleteCoachAccount(formData: FormData) {
  const { redirect } = await import('next/navigation');
  const { createAdminClient } = await import('@/lib/supabase/server');
  const { supabase, coach } = await requireCoach();
  if (String(formData.get('confirm')) !== 'DELETE MY ACCOUNT') redirect('/coach/settings?error=Type DELETE MY ACCOUNT to confirm');
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
