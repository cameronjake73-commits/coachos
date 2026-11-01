'use server';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  if (password.length < 8) redirect(`/invite/${token}?error=Password must be at least 8 characters`);

  const admin = createAdminClient();
  const { data: invite } = await admin.from('invites')
    .select('token, email, client_id, accepted_at, expires_at, clients(full_name)')
    .eq('token', token).single();
  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    redirect(`/invite/${token}?error=This invite link is invalid or has expired. Ask your coach for a new one.`);
  }
  const fullName = (invite.clients as unknown as { full_name: string } | null)?.full_name ?? '';

  const { data: created, error } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { role: 'client', full_name: fullName },
  });
  if (error || !created.user) {
    redirect(`/invite/${token}?error=${encodeURIComponent(error?.message?.toLowerCase().includes('already') ? 'An account with this email already exists. If you have used COACHOS with another coach, ask your new coach to invite a different email address.' : error?.message || 'Could not create account')}`);
  }

  await admin.from('clients').update({ user_id: created.user.id }).eq('id', invite.client_id);
  await admin.from('invites').update({ accepted_at: new Date().toISOString() }).eq('token', token);

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: invite.email, password });
  redirect('/app/onboarding');
}
