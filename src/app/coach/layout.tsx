import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { requireCoach, coachIsLocked } from '@/lib/auth';
import { CoachNav, MobileNav } from '@/components/coach-nav';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { Flash } from '@/components/flash';
import { PendingButton } from '@/components/form-bits';
import { signOut } from '@/app/login/actions';
import { daysUntil } from '@/lib/format';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const { supabase, coach, user, fullName } = await requireCoach();
  const [{ count: pending }, { count: unread }] = await Promise.all([
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).eq('status', 'submitted'),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).eq('sender', 'client').is('read_at', null),
  ]);
  const path = (await headers()).get('x-pathname') || '';
  const locked = coachIsLocked(coach) && !path.startsWith('/coach/billing') && !path.startsWith('/coach/settings');
  const trialDays = coach.plan === 'trial' ? Math.max(daysUntil(coach.trial_ends_at) ?? 0, 0) : null;
  const name = fullName || coach.business_name || 'Coach';
  const counts = { pendingCheckins: pending ?? 0, unreadMessages: unread ?? 0 };
  const notifications = counts.pendingCheckins + counts.unreadMessages;

  const planNudge = coach.plan !== 'pro' && (
    <Link href="/coach/billing" className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100/40 p-3 transition hover:border-slate-300">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-400"><Icon name="crown" className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-slate-800">{coach.plan === 'trial' ? `${trialDays} day${trialDays === 1 ? '' : 's'} left in trial` : 'Move to unlimited'}</span>
        <span className="block text-xs text-slate-500">{coach.plan === 'trial' ? 'Subscribe to keep going' : 'One plan, every feature'}</span>
      </span>
      <Icon name="chevronRight" className="h-4 w-4 text-slate-400 transition group-hover:text-slate-700" />
    </Link>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-slate-200 bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col">
        <Link href="/coach" className="flex items-center gap-2.5 px-5 py-5 text-[17px] font-bold tracking-tight">
          <img src="/icon.svg" alt="" className="h-7 w-7" /> COACHOS
        </Link>
        <div className="flex-1 overflow-y-auto px-3"><CoachNav {...counts} /></div>
        <div className="space-y-3 p-3">
          {planNudge}
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <Avatar name={name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{name}</div>
              <div className="truncate text-xs text-slate-500">{coach.business_name || 'Coach'}</div>
            </div>
            <form action={signOut}><PendingButton title="Sign out" aria-label="Sign out" className="icon-btn h-8 w-8"><Icon name="logout" className="h-4 w-4" /></PendingButton></form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-4 md:px-8 lg:h-16 lg:gap-4">
            <Link href="/coach" className="flex items-center gap-2 text-[15px] font-bold tracking-tight lg:hidden"><img src="/icon.svg" alt="" className="h-7 w-7" />COACHOS</Link>
            <form action="/coach/clients" className="relative hidden w-full max-w-md lg:block" role="search">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input name="q" placeholder="Search clients…" aria-label="Search clients" className="input pl-9" />
            </form>
            <div className="ml-auto flex items-center gap-1 lg:gap-2">
              <Link href="/coach/clients?focus=search" className="icon-btn lg:hidden" aria-label="Search clients"><Icon name="search" /></Link>
              <Link href={counts.pendingCheckins > 0 ? '/coach/checkins' : '/coach/messages'} className="icon-btn relative" aria-label={`${counts.pendingCheckins} check-ins to review, ${counts.unreadMessages} unread messages`}>
                <Icon name="bell" />
                {notifications > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-50 lg:right-1.5 lg:top-1.5" />}
              </Link>
              <Link href="/coach/settings" aria-label="Your settings" className="ml-1 rounded-full"><Avatar name={name} size={32} /></Link>
            </div>
          </div>
        </header>
        <main className="animate-fade-in px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-12">
          {locked ? (
            <div className="card mx-auto mt-6 max-w-md text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-400"><Icon name="lock" /></span>
              <h1 className="mt-3">Your trial has ended</h1>
              <p className="mt-2 text-slate-600">Your clients and data are safe. Choose a plan to keep coaching with COACHOS.</p>
              <Link href="/coach/billing" className="btn-primary mt-5">Choose a plan</Link>
            </div>
          ) : children}
        </main>
      </div>

      <MobileNav counts={counts} footer={
        <div className="space-y-3">
          {planNudge}
          <div className="flex items-center gap-3">
            <Avatar name={name} size={36} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{name}</div><div className="truncate text-xs text-slate-500">{user.email}</div></div>
            <form action={signOut}><PendingButton className="btn-secondary btn-sm" pendingLabel="Signing out…"><Icon name="logout" className="h-4 w-4" />Sign out</PendingButton></form>
          </div>
        </div>
      } />
      <Suspense><Flash /></Suspense>
    </div>
  );
}
