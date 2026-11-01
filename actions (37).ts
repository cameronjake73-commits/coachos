'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const next = String(formData.get('next') || '');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(`/login?error=${encodeURIComponent(error?.message || 'Login failed')}`);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  const home = profile?.role === 'client' ? '/app' : '/coach';
  redirect(next.startsWith(home) ? next : home);
}

export async function signupCoach(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const fullName = String(formData.get('full_name') || '').trim();
  const business = String(formData.get('business_name') || '').trim();
  if (password.length < 8) redirect('/signup?error=Password must be at least 8 characters');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'coach', full_name: fullName, business_name: business },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/coach`,
    },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect('/login?message=Check your email to confirm your account, then log in.');
  redirect('/coach');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get('email') || '').trim();
  if (email) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });
  }
  // Same message whether or not the account exists (prevents email enumeration).
  redirect('/forgot-password?sent=1');
}

export async function setNewPassword(formData: FormData) {
  const supabase = await createClient();
  const password = String(formData.get('password') || '');
  if (password.length < 8) redirect('/reset-password?error=Password must be at least 8 characters');
  if (password !== String(formData.get('confirm') || '')) redirect('/reset-password?error=Passwords do not match');
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error || !data.user) redirect(`/reset-password?error=${encodeURIComponent(error?.message || 'Reset link expired. Request a new one.')}`);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  redirect(profile?.role === 'client' ? '/app' : '/coach');
}
