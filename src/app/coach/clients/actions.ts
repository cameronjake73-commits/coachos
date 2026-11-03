'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { requireCoach } from '@/lib/auth';
import { recomputeRisk } from '@/lib/risk-service';
import { notifyInvite, notifyNewMessage } from '@/lib/notify';
import { addMonths } from '@/lib/coaching';
import { draftAndSave, summariseAndSave } from '@/lib/analyze-service';

const str = (f: FormData, k: string, max = 2000) => { const v = String(f.get(k) ?? '').trim(); return v === '' ? null : v.slice(0, max); };
const num = (f: FormData, k: string) => { const v = str(f, k); if (v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const friendly = (msg: string) => msg.includes('CLIENT_LIMIT') ? 'You have reached your plan\'s client limit. Upgrade in Billing or archive a client.'
  : msg.includes('duplicate') ? 'A client with this email already exists.' : msg;

export async function addClient(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const full_name = str(formData, 'full_name', 120);
  const email = str(formData, 'email', 200)?.toLowerCase();
  if (!full_name || !email) redirect('/coach/clients/new?error=Name and email are required');
  if (!EMAIL.test(email)) redirect('/coach/clients/new?error=That email address doesn\'t look right');
  const fee = num(formData, 'monthly_fee');
  if (fee != null && (fee < 0 || fee > 100000)) redirect('/coach/clients/new?error=Monthly fee must be between £0 and £100,000');
  const { data, error } = await supabase.from('clients').insert({
    coach_id: coach.id, full_name, email,
    phone: str(formData, 'phone', 40),
    goal: str(formData, 'goal', 300),
    target_weight_kg: num(formData, 'target_weight_kg'),
    goal_deadline: str(formData, 'goal_deadline'),
    start_date: str(formData, 'start_date') ?? new Date().toISOString().slice(0, 10),
    monthly_fee: fee,
    renewal_date: str(formData, 'renewal_date'),
    notes: str(formData, 'notes', 5000),
  }).select('id').single();
  if (error) redirect(`/coach/clients/new?error=${encodeURIComponent(friendly(error.message))}`);
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
  const back = `/coach/clients/${id}?tab=details`;
  const full_name = str(formData, 'full_name', 120);
  const email = str(formData, 'email', 200)?.toLowerCase();
  if (!full_name) redirect(`${back}&error=Name is required`);
  if (email && !EMAIL.test(email)) redirect(`${back}&error=That email address doesn't look right`);
  const status = str(formData, 'status');
  const { data: before } = await supabase.from('clients').select('status').eq('id', id).single();
  const { error } = await supabase.from('clients').update({
    full_name,
    ...(email ? { email } : {}),
    phone: str(formData, 'phone', 40),
    goal: str(formData, 'goal', 300),
    target_weight_kg: num(formData, 'target_weight_kg'),
    goal_deadline: str(formData, 'goal_deadline'),
    start_date: str(formData, 'start_date'),
    monthly_fee: num(formData, 'monthly_fee'),
    renewal_date: str(formData, 'renewal_date'),
    payment_status: str(formData, 'payment_status') ?? 'paid',
    ...(status ? { status, archived_at: status === 'archived' ? (before?.status === 'archived' ? undefined : new Date().toISOString()) : null } : {}),
    notes: str(formData, 'notes', 5000),
    email_reminders: formData.get('email_reminders') === 'on',
  }).eq('id', id);
  if (error) redirect(`${back}&error=${encodeURIComponent(friendly(error.message))}`);
  await recomputeRisk(supabase, id);
  redirect(`${back}&flash=saved`);
}

export async function archiveClient(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  await supabase.from('clients').update({ status: 'archived', archived_at: new Date().toISOString() }).eq('id', id);
  await supabase.from('programs').update({ is_active: false }).eq('client_id', id);
  redirect(`/coach/clients/${id}?flash=archived`);
}

export async function restoreClient(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  const { data: c } = await supabase.from('clients').select('user_id, health_consent_at').eq('id', id).single();
  const { error } = await supabase.from('clients').update({ status: c?.user_id && c.health_consent_at ? 'active' : 'invited', archived_at: null }).eq('id', id);
  if (error) redirect(`/coach/clients/${id}?error=${encodeURIComponent(friendly(error.message))}`);
  await recomputeRisk(supabase, id);
  redirect(`/coach/clients/${id}?flash=restored`);
}

/** Records that the client has paid for another month: marks paid and moves the renewal date on by a month. */
export async function recordRenewal(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  const { data: c } = await supabase.from('clients').select('renewal_date').eq('id', id).single();
  const today = new Date().toISOString().slice(0, 10);
  const from = c?.renewal_date && c.renewal_date > addMonths(today, -1) ? c.renewal_date : today;
  await supabase.from('clients').update({ payment_status: 'paid', renewal_date: addMonths(from, 1) }).eq('id', id);
  await recomputeRisk(supabase, id);
  const back = String(formData.get('back') || `/coach/clients/${id}`);
  redirect(`${back}${back.includes('?') ? '&' : '?'}flash=renewed`);
}

export async function saveNutrition(formData: FormData) {
  const { supabase } = await requireCoach();
  const client_id = String(formData.get('client_id'));
  const habits = String(formData.get('habits') ?? '').split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 15).map((h) => h.slice(0, 120));
  const { error } = await supabase.from('nutrition_targets').upsert({
    client_id,
    calories: num(formData, 'calories'),
    protein_g: num(formData, 'protein_g'),
    carbs_g: num(formData, 'carbs_g'),
    fat_g: num(formData, 'fat_g'),
    water_l: num(formData, 'water_l'),
    habits,
    notes: str(formData, 'notes', 3000),
    updated_at: new Date().toISOString(),
  });
  if (error) redirect(`/coach/clients/${client_id}?tab=nutrition&error=${encodeURIComponent(error.message)}`);
  redirect(`/coach/clients/${client_id}?tab=nutrition&flash=saved`);
}

export async function sendCoachMessage(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const client_id = String(formData.get('client_id'));
  const body = String(formData.get('body') ?? '').trim().slice(0, 5000);
  if (body) {
    await supabase.from('messages').insert({ client_id, coach_id: coach.id, sender: 'coach', body });
    if (formData.get('used_draft')) await supabase.from('clients').update({ ai_draft: null, ai_draft_at: null }).eq('id', client_id);
    after(() => notifyNewMessage(client_id, 'coach'));
  }
  const back = String(formData.get('back') || '');
  if (back) redirect(back);
  revalidatePath(`/coach/clients/${client_id}`);
  revalidatePath('/coach/messages');
}

export async function generateClientSummary(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('client_id'));
  try { await summariseAndSave(supabase, coach, id); }
  catch (e) { redirect(`/coach/clients/${id}?error=${encodeURIComponent((e as Error).message)}`); }
  redirect(`/coach/clients/${id}?flash=analysed`);
}

export async function generateDraft(formData: FormData) {
  const { supabase, coach, user } = await requireCoach();
  const id = String(formData.get('client_id'));
  const back = String(formData.get('back') || `/coach/clients/${id}?tab=messages`);
  const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  try { await draftAndSave(supabase, coach, id, (p?.full_name || 'Coach').split(' ')[0]); }
  catch (e) { redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent((e as Error).message)}`); }
  redirect(`${back}${back.includes('?') ? '&' : '?'}draft=ai&flash=drafted`);
}

export async function deleteClientData(formData: FormData) {
  // GDPR erasure: removes the client and all their data (cascades), including photos in storage.
  const { supabase } = await requireCoach();
  const id = String(formData.get('client_id'));
  if (String(formData.get('confirm')).trim().toUpperCase() !== 'DELETE') redirect(`/coach/clients/${id}?tab=details&error=Type DELETE to confirm`);
  const { data: photos } = await supabase.from('progress_photos').select('storage_path').eq('client_id', id);
  const { data: client } = await supabase.from('clients').select('user_id').eq('id', id).single();
  const { createAdminClient } = await import('@/lib/supabase/server');
  if (photos?.length) await createAdminClient().storage.from('progress-photos').remove(photos.map((p) => p.storage_path));
  await supabase.from('clients').delete().eq('id', id);
  if (client?.user_id) await createAdminClient().auth.admin.deleteUser(client.user_id);
  redirect('/coach/clients?flash=deleted');
}

/** Bulk import from the CSV wizard. Re-validates every row, skips existing emails and respects the plan limit. */
export async function importClients(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  type Row = { full_name: string; email: string; phone: string | null; goal: string | null; monthly_fee: number | null; renewal_date: string | null; start_date: string | null; notes: string | null };
  let rows: Row[] = [];
  try { rows = JSON.parse(String(formData.get('rows') ?? '[]')); } catch { redirect('/coach/clients/import?error=Could not read the import. Please try again.'); }
  const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const clean = rows.slice(0, 500).map((r) => ({
    full_name: String(r.full_name ?? '').trim().slice(0, 120),
    email: String(r.email ?? '').trim().toLowerCase().slice(0, 200),
    phone: r.phone ? String(r.phone).slice(0, 40) : null,
    goal: r.goal ? String(r.goal).slice(0, 300) : null,
    monthly_fee: typeof r.monthly_fee === 'number' && r.monthly_fee >= 0 && r.monthly_fee <= 100000 ? r.monthly_fee : null,
    renewal_date: isDate(r.renewal_date),
    start_date: isDate(r.start_date) ?? new Date().toISOString().slice(0, 10),
    notes: r.notes ? String(r.notes).slice(0, 5000) : null,
  })).filter((r) => r.full_name && EMAIL.test(r.email));

  const [{ data: existing }, { count }] = await Promise.all([
    supabase.from('clients').select('email').eq('coach_id', coach.id),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).neq('status', 'archived'),
  ]);
  const taken = new Set((existing ?? []).map((c) => c.email.toLowerCase()));
  const unique = clean.filter((r) => (taken.has(r.email) ? false : (taken.add(r.email), true)));
  const room = Math.max(0, coach.client_limit - (count ?? 0));
  const batch = unique.slice(0, room);
  if (!batch.length) redirect(`/coach/clients/import?error=${encodeURIComponent(room === 0 ? 'You have no client places left. Upgrade in Billing or archive a client.' : 'No new clients to import. They may already be in COACHOS.')}`);

  const { data: inserted, error } = await supabase.from('clients').insert(batch.map((r) => ({ ...r, coach_id: coach.id, status: 'invited' }))).select('id, email');
  if (error) redirect(`/coach/clients/import?error=${encodeURIComponent(friendly(error.message))}`);
  await supabase.from('invites').insert((inserted ?? []).map((c) => ({ client_id: c.id, coach_id: coach.id, email: c.email })));
  if (formData.get('send_email') === 'on') {
    const ids = (inserted ?? []).map((c) => c.id);
    after(async () => { for (const id of ids) { try { await notifyInvite(id); } catch (e) { console.error('invite email failed', e); } } });
  }
  const n = inserted?.length ?? 0;
  const skipped = clean.length - n;
  redirect(`/coach/clients?filter=invited&flash=${encodeURIComponent(`${n} client${n === 1 ? '' : 's'} imported${skipped ? `, ${skipped} skipped` : ''}`)}`);
}

/** Sends the same (personalised) message to many clients as individual private messages. */
export async function sendBroadcast(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const { broadcastAudience } = await import('@/lib/broadcast');
  const body = String(formData.get('body') ?? '').trim().slice(0, 3000);
  const audience = String(formData.get('audience') ?? 'active');
  if (!body) redirect('/coach/messages/broadcast?error=Write a message first');
  const all = await broadcastAudience(supabase, coach.id, coach.checkin_day);
  const picked = new Set(formData.getAll('client_id').map(String));
  const to = audience === 'pick' ? all.filter((c) => picked.has(c.id)) : all.filter((c) => c.groups.includes(audience as 'active'));
  if (!to.length) redirect('/coach/messages/broadcast?error=No clients selected');
  const rows = to.slice(0, 300).map((c) => ({ client_id: c.id, coach_id: coach.id, sender: 'coach', body: body.replace(/\{first_name\}/gi, c.full_name.split(' ')[0]) }));
  const { error } = await supabase.from('messages').insert(rows);
  if (error) redirect(`/coach/messages/broadcast?error=${encodeURIComponent(error.message)}`);
  const ids = rows.map((r) => r.client_id);
  after(async () => { for (const id of ids) { try { await notifyNewMessage(id, 'coach'); } catch (e) { console.error('broadcast email failed', e); } } });
  redirect(`/coach/messages?flash=${encodeURIComponent(`Sent to ${rows.length} client${rows.length === 1 ? '' : 's'}`)}`);
}
