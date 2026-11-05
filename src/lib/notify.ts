import { createAdminClient } from '@/lib/supabase/server';
import { emails, sendEmail } from '@/lib/email';
import { coachAvailable } from '@/lib/boundaries';

async function ctx(clientId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from('clients')
    .select('id, full_name, email, user_id, coach_id, coaches(business_name, profiles(full_name, email))').eq('id', clientId).single();
  if (!data) return null;
  const coach = data.coaches as unknown as { business_name: string | null; profiles: { full_name: string | null; email: string | null } | null };
  return {
    admin, client: data,
    coachName: coach?.business_name || coach?.profiles?.full_name || 'Your coach',
    coachPerson: coach?.profiles?.full_name || 'Coach',
    coachEmail: coach?.profiles?.email ?? null,
  };
}

export async function notifyInvite(clientId: string) {
  const c = await ctx(clientId);
  if (!c) return;
  const { data: inv } = await c.admin.from('invites').select('token').eq('client_id', clientId).is('accepted_at', null)
    .order('created_at', { ascending: false }).limit(1);
  if (!inv?.[0]) return;
  const e = emails.invite({ clientName: c.client.full_name, coachName: c.coachName, token: inv[0].token });
  await sendEmail(c.client.email, e.subject, e.html);
}

export async function notifyCoachReplied(clientId: string) {
  const c = await ctx(clientId);
  if (!c?.client.user_id) return;
  const e = emails.coachReplied({ clientName: c.client.full_name, coachName: c.coachName });
  await sendEmail(c.client.email, e.subject, e.html);
}

/** Emails the recipient only for the first unread message, so a burst of messages sends one email. */
export async function notifyNewMessage(clientId: string, sender: 'coach' | 'client') {
  const c = await ctx(clientId);
  if (!c) return;
  const { count } = await c.admin.from('messages').select('id', { count: 'exact', head: true })
    .eq('client_id', clientId).eq('sender', sender).is('read_at', null);
  if ((count ?? 0) > 1) return;
  if (sender === 'coach') {
    if (!c.client.user_id) return;
    const e = emails.newMessage({ toName: c.client.full_name, fromName: c.coachName, forCoach: false });
    await sendEmail(c.client.email, e.subject, e.html);
  } else if (c.coachEmail) {
    // Respect the coach's working hours: out-of-hours messages wait for the morning summary instead.
    if (!(await coachAvailable(c.admin, c.client.coach_id))) return;
    const e = emails.newMessage({ toName: c.coachPerson, fromName: c.client.full_name, forCoach: true, clientId });
    await sendEmail(c.coachEmail, e.subject, e.html);
  }
}
