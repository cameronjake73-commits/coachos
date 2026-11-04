import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Client, Coach } from '@/lib/types';

/** Who is signed in. Verified from the login token itself (no trip to the auth server when the project
 * uses signing keys), and cached so the layout and the page share one check per request. */
const currentUser = cache(async () => {
  const supabase = await createClient();
  let user: SessionUser | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    const c = data?.claims as { sub?: string; email?: string; user_metadata?: { role?: string } } | undefined;
    if (c?.sub) user = { id: c.sub, email: c.email ?? null, role: c.user_metadata?.role ?? null };
  } catch { user = null; }
  return { supabase, user };
});

export type SessionUser = { id: string; email: string | null; role: string | null };

export const getUserAndRole = cache(async () => {
  const { supabase, user } = await currentUser();
  if (!user) return { supabase, user: null, role: null as null | 'coach' | 'client', fullName: null as string | null };
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  return { supabase, user, role: (profile?.role ?? null) as null | 'coach' | 'client', fullName: (profile?.full_name ?? null) as string | null };
});

export const requireCoach = cache(async () => {
  const { supabase, user } = await currentUser();
  if (!user) redirect('/login');
  // Profile and coach record are fetched together rather than one after the other.
  const [{ data: profile }, { data: coach }] = await Promise.all([
    supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
    supabase.from('coaches').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (profile?.role !== 'coach') redirect('/app');
  if (!coach) redirect('/login');
  return { supabase, user, coach: coach as Coach, fullName: (profile?.full_name ?? null) as string | null };
});

const requireClientCached = cache(async (allowIncompleteOnboarding: boolean) => {
  const { supabase, user } = await currentUser();
  if (!user) redirect('/login');
  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('clients').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  if (profile?.role !== 'client') redirect('/coach');
  if (!client) redirect('/login?error=no-client');
  if (!allowIncompleteOnboarding && !client.health_consent_at) redirect('/app/onboarding');
  return { supabase, user, client: client as Client };
});

export function requireClient(opts: { allowIncompleteOnboarding?: boolean } = {}) {
  return requireClientCached(!!opts.allowIncompleteOnboarding);
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
