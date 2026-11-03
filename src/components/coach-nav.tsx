'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

type Item = { href: string; label: string; icon: string; badge?: 'checkins' | 'messages' };
const items: Item[] = [
  { href: '/coach', label: 'Dashboard', icon: 'dashboard' },
  { href: '/coach/clients', label: 'Clients', icon: 'clients' },
  { href: '/coach/checkins', label: 'Check-ins', icon: 'checkins', badge: 'checkins' },
  { href: '/coach/messages', label: 'Messages', icon: 'messages', badge: 'messages' },
  { href: '/coach/programs', label: 'Programmes', icon: 'programs' },
  { href: '/coach/exercises', label: 'Exercises', icon: 'exercises' },
  { href: '/coach/analytics', label: 'Analytics', icon: 'analytics' },
];
const secondary: Item[] = [
  { href: '/coach/settings', label: 'Settings', icon: 'settings' },
  { href: '/coach/billing', label: 'Billing', icon: 'billing' },
];

const isActive = (path: string, href: string) => (href === '/coach' ? path === '/coach' : path === href || path.startsWith(href + '/'));

type Counts = { pendingCheckins: number; unreadMessages: number };
const countFor = (it: Item, c: Counts) => (it.badge === 'checkins' ? c.pendingCheckins : it.badge === 'messages' ? c.unreadMessages : 0);

/** Desktop sidebar navigation. */
export function CoachNav(counts: Counts) {
  const path = usePathname();
  const link = (it: Item) => {
    const active = isActive(path, it.href);
    const count = countFor(it, counts);
    return (
      <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active
          ? 'bg-brand-50 text-slate-900 shadow-[inset_0_0_0_1px_rgba(124,92,255,0.28)]'
          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}`}>
        <Icon name={it.icon} className={`h-[18px] w-[18px] ${active ? 'text-brand-300' : 'text-slate-500 group-hover:text-slate-700'}`} />
        <span className="flex-1">{it.label}</span>
        {count > 0 && <span className={`num min-w-[20px] rounded-full px-1.5 text-center text-2xs font-semibold leading-5 ${it.badge === 'messages' ? 'bg-red-500 text-white' : 'bg-brand-600 text-white'}`}>{count}</span>}
      </Link>
    );
  };
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map(link)}
      <div className="my-3 border-t border-slate-200" />
      {secondary.map(link)}
    </nav>
  );
}

/** Phone navigation: bottom tab bar for the main sections plus a "More" sheet for the rest. */
export function MobileNav({ counts, footer }: { counts: Counts; footer?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const tabs = items.slice(0, 4);
  const more = [...items.slice(4), ...secondary];
  const moreActive = more.some((it) => isActive(path, it.href));

  return (
    <>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-[#0c0d17]/95 backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-2xl grid-cols-5">
          {tabs.map((it) => {
            const active = isActive(path, it.href);
            const count = countFor(it, counts);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? 'page' : undefined}
                  className={`relative flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                  <span className={`relative flex h-7 w-12 items-center justify-center rounded-full transition ${active ? 'bg-brand-50 text-brand-300' : ''}`}>
                    <Icon name={it.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.8} />
                    {count > 0 && <span className={`num absolute -right-0.5 -top-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-[#0c0d17] ${it.badge === 'messages' ? 'bg-red-500' : 'bg-brand-600'}`}>{count > 99 ? '99+' : count}</span>}
                  </span>
                  {it.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog"
              className={`flex h-[58px] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${moreActive ? 'text-slate-900' : 'text-slate-500'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? 'bg-brand-50 text-brand-300' : ''}`}><Icon name="menu" className="h-[22px] w-[22px]" /></span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button aria-label="Close menu" className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 animate-sheet-up rounded-t-3xl border-t border-slate-300 bg-[#11131f] shadow-pop">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <span className="text-[15px] font-semibold">More</span>
              <button onClick={() => setOpen(false)} className="icon-btn -mr-2" aria-label="Close"><Icon name="x" /></button>
            </div>
            <ul className="grid grid-cols-3 gap-2 px-4 pb-3">
              {more.map((it) => {
                const active = isActive(path, it.href);
                return (
                  <li key={it.href}>
                    <Link href={it.href} className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-[13px] font-medium ${active ? 'border-brand-500/50 bg-brand-50 text-slate-900' : 'border-slate-200 bg-slate-100/40 text-slate-700'}`}>
                      <Icon name={it.icon} className={`h-6 w-6 ${active ? 'text-brand-300' : 'text-slate-500'}`} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {footer && <div className="border-t border-slate-200 px-5 py-4">{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}
