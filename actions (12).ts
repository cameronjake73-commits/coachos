'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { after } from 'next/server';
import { recomputeRisk } from '@/lib/risk-service';
import { notifyInvite, notifyNewMessage } from '@/lib/notify';

const str = (f: FormData, k: string) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : v; };
const num = (f: FormData, k: string) => { const v = str(f, k); return v == null ? null : Number(v); };

export async function addClient(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const full_name = str(formData, 'full_name');
  const email = str(formData, 'email')?.toLowerCase();
  if (!full_name || !email) redirect('/coach/clients?error=Name and email are required');
  const { data, error } = await supabase.from('clients').insert({
    coach_id: coach.id, full_name, email,
    goal: str(formData, 'goal'),
    monthly_fee: num(formData, 'monthly_fee'),
    renewal_date: str(formData, 'renewal_date'),
  }).select('id').single();
  if (error) {
    const msg = error.message.includes('CLIENT_LIMIT_REACHED') ? 'You have reached your plan\'s client limit. Upgrade in Billing.'
      : error.message.includes('duplicate') ? 'A client with this email already exists.' : error.message;
    redirect(`/coach/clients?error=${encodeURIComponent(msg)}`);
  }
  await supabase.from('invites').insert({ client_id: data.id, coach_id: coach.id, email });
  const sendNow = formData.get('send_email') === 'on';
  if (sendNow) after(() => notifyInvite(data.id));
  redirect(`/coach/clients/${data.id}?invited=${sendNow ? 'emailed' : '1'}`);
}

export async function newInvite(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('client_id'));
  const { data: c } = await supabase.from('clients').select('email').eq('id', id).single();
  if (c) await supabase.from('invites').insert({ client_id: id, coach_id: coach.id, email: c.email });
  if (formData.get('send_email') === 'on') after(() => notifyInvite(id));
  revalidatePath(`/coach/clients/${id}`);
}

export async function emailInvite(formData: FormData) {
  await requireCoach();
  const id = String(formData.get('client_id'));
  await notifyInvite(id);
  redirect(`/coach/clients/${id}?invited=emailed`);
}

export async function updateClient(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  const { error } = await supabase.from('clients').update({
    full_name: str(formData, 'full_name') ?? undefined,
    goal: str(formData, 'goal'),
    monthly_fee: num(formData, 'monthly_fee'),
    renewal_date: str(formData, 'renewal_date'),
    payment_status: str(formData, 'payment_status') ?? 'paid',
    status: str(formData, 'status') ?? undefined,
    notes: str(formData, 'notes'),
    email_reminders: formData.get('email_reminders') === 'on',
  }).eq('id', id);
  if (error) redirect(`/coach/clients/${id}?tab=settings&error=${encodeURIComponent(error.message.includes('CLIENT_LIMIT') ? 'Client limit reached for your plan.' : error.message)}`);
  await recomputeRisk(supabase, id);
  revalidatePath(`/coach/clients/${id}`);
}

export async function saveNutrition(formData: FormData) {
  const { supabase } = await requireCoach();
  const client_id = String(formData.get('client_id'));
  const habits = String(formData.get('habits') ?? '').split('\n').map((h) => h.trim()).filter(Boolean);
  await supabase.from('nutrition_targets').upsert({
    client_id,
    calories: num(formData, 'calories'),
    protein_g: num(formData, 'protein_g'),
    carbs_g: num(formData, 'carbs_g'),
    fat_g: num(formData, 'fat_g'),
    water_l: num(formData, 'water_l'),
    habits,
    notes: str(formData, 'notes'),
    updated_at: new Date().toISOString(),
  });
  revalidatePath(`/coach/clients/${client_id}`);
}

export async function sendCoachMessage(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const client_id = String(formData.get('client_id'));
  const body = String(formData.get('body') ?? '').trim();
  if (body) {
    await supabase.from('messages').insert({ client_id, coach_id: coach.id, sender: 'coach', body });
    after(() => notifyNewMessage(client_id, 'coach'));
  }
  revalidatePath(`/coach/clients/${client_id}`);
}

export async function deleteClientData(formData: FormData) {
  // GDPR erasure: removes the client and all their data (cascades), including photos in storage.
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  if (String(formData.get('confirm')) !== 'DELETE') redirect(`/coach/clients/${id}?tab=settings&error=Type DELETE to confirm`);
  const { data: photos } = await supabase.from('progress_photos').select('storage_path').eq('client_id', id);
  const { data: client } = await supabase.from('clients').select('user_id').eq('id', id).single();
  if (photos?.length) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    await createAdminClient().storage.from('progress-photos').remove(photos.map((p) => p.storage_path));
  }
  await supabase.from('clients').delete().eq('id', id);
  if (client?.user_id) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    await createAdminClient().auth.admin.deleteUser(client.user_id);
  }
  redirect('/coach/clients');
}
