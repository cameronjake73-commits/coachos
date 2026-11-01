import Link from 'next/link';
import { headers } from 'next/headers';
import { requireCoach, coachIsLocked } from '@/lib/auth';
import { CoachNav } from '@/components/coach-nav';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { signOut } from '@/app/login/actions';
import { daysUntil } from '@/lib/format';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const { supabase, coach, user } = await requireCoach();
  const [{ count: pending }, { count: unread }, { data: profile }] = await Promise.all([
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).eq('status', 'submitted'),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).eq('sender', 'client').is('read_at', null),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);
  const path = (await headers()).get('x-pathname') || '';
  const locked = coachIsLocked(coach) && !path.startsWith('/coach/billing');
  const trialDays = coach.plan === 'trial' ? daysUntil(coach.trial_ends_at) : null;
  const name = profile?.full_name || coach.business_name || 'Coach';
  const notifications = (pending ?? 0) + (unread ?? 0);

  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col border-b border-slate-200 bg-sidebar md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <Link href="/coach" className="flex items-center gap-2.5 px-6 py-5 text-xl font-bold tracking-tight">
          <img src="/icon.svg" alt="" className="h-8 w-8" /> COACHOS
        </Link>
        <div className="px-3 pb-3 md:flex-1 md:overflow-y-auto">
          <CoachNav pendingCheckins={pending ?? 0} unreadMessages={unread ?? 0} />
        </div>
        {coach.plan !== 'pro' && (
          <div className="mx-3 mb-3 hidden rounded-2xl border border-slate-200 bg-surface p-4 text-center md:block">
            <Icon name="crown" className="mx-auto h-5 w-5 text-amber-400" />
            <div className="mt-1 font-semibold">{coach.plan === 'trial' ? 'Choose your plan' : 'Upgrade your plan'}</div>
            <p className="mt-1 text-xs text-slate-500">{coach.plan === 'trial' ? `${Math.max(trialDays ?? 0, 0)} days left in your trial.` : `More client places, same features.`}</p>
            <Link href="/coach/billing" className="btn-primary mt-3 w-full py-1.5">{coach.plan === 'trial' ? 'See plans' : 'Upgrade'}</Link>
          </div>
        )}
        <div className="hidden items-center gap-3 border-t border-slate-200 px-4 py-4 md:flex">
          <Avatar name={name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-slate-500">{coach.business_name || 'Coach'}</div>
          </div>
          <form action={signOut}><button title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Icon name="logout" className="h-4 w-4" /></button></form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur md:px-8">
          <form action="/coach/clients" className="relative w-full max-w-xl">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input name="q" placeholder="Search clients…" className="w-full rounded-xl border border-slate-200 bg-surface py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <Link href={(pending ?? 0) > 0 ? '/coach/checkins' : '/coach/messages'} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900" title={`${pending ?? 0} check-ins, ${unread ?? 0} unread messages`}>
              <Icon name="bell" className="h-6 w-6" />
              {notifications > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-50" />}
            </Link>
            <Link href="/coach/settings" title="Settings"><Avatar name={name} size={40} /></Link>
          </div>
        </header>
        <main className="p-4 md:p-8">
          {locked ? (
            <div className="card mx-auto max-w-lg text-center">
              <h1>Your trial has ended</h1>
              <p className="mt-2 text-slate-600">Your clients and data are safe. Choose a plan to keep coaching with COACHOS.</p>
              <Link href="/coach/billing" className="btn-primary mt-4">Choose a plan</Link>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}
