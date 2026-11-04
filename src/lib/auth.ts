import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Client, Coach } from '@/lib/types';

export async function getUserAndRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as null | 'coach' | 'client' };
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  return { supabase, user, role: (profile?.role ?? null) as null | 'coach' | 'client', fullName: profile?.full_name as string | null };
}

export async function requireCoach() {
  const { supabase, user, role } = await getUserAndRole();
  if (!user) redirect('/login');
  if (role !== 'coach') redirect('/app');
  const { data: coach } = await supabase.from('coaches').select('*').eq('id', user.id).single();
  if (!coach) redirect('/login');
  return { supabase, user, coach: coach as Coach };
}

export async function requireClient(opts: { allowIncompleteOnboarding?: boolean } = {}) {
  const { supabase, user, role } = await getUserAndRole();
  if (!user) redirect('/login');
  if (role !== 'client') redirect('/coach');
  const { data: client } = await supabase.from('clients').select('*').eq('user_id', user.id).single();
  if (!client) redirect('/login?error=no-client');
  if (!opts.allowIncompleteOnboarding && !client.health_consent_at) redirect('/app/onboarding');
  return { supabase, user, client: client as Client };
}

/** True when the coach's trial has ended and there is no active subscription. */
export function coachIsLocked(coach: Coach) {
  const active = ['active', 'trialing', 'past_due'].includes(coach.subscription_status);
  if (coach.plan === 'trial') return new Date(coach.trial_ends_at).getTime() < Date.now();
  return !active;
}

/** Sends someone who is already logged in straight to their side of the app (used by the landing, login and signup pages). */
export async function redirectIfSignedIn() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  let role: 'coach' | 'client' | null = null;
  try {
    const r = await getUserAndRole();
    if (r.user) role = r.role ?? 'coach';
  } catch { return; }
  if (role) redirect(role === 'client' ? '/app' : '/coach');
}
