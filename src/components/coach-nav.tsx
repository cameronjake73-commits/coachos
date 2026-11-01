'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

type Item = { href: string; label: string; icon: string; badge?: 'checkins' | 'messages' };
const items: Item[] = [
  { href: '/coach', label: 'Dashboard', icon: 'dashboard' },
  { href: '/coach/clients', label: 'Clients', icon: 'clients' },
  { href: '/coach/programs', label: 'Programmes', icon: 'programs' },
  { href: '/coach/exercises', label: 'Exercises', icon: 'exercises' },
  { href: '/coach/checkins', label: 'Check-ins', icon: 'checkins', badge: 'checkins' },
  { href: '/coach/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/coach/messages', label: 'Messages', icon: 'messages', badge: 'messages' },
  { href: '/coach/settings', label: 'Settings', icon: 'settings' },
  { href: '/coach/billing', label: 'Billing', icon: 'billing' },
];

export function CoachNav({ pendingCheckins, unreadMessages }: { pendingCheckins: number; unreadMessages: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((it) => {
        const active = it.href === '/coach' ? path === '/coach' : path.startsWith(it.href);
        const count = it.badge === 'checkins' ? pendingCheckins : it.badge === 'messages' ? unreadMessages : 0;
        return (
          <Link key={it.href} href={it.href}
            className={`group flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition ${active
              ? 'bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-[0_8px_24px_-10px_rgba(124,92,255,0.9)]'
              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}`}>
            <Icon name={it.icon} className={`h-5 w-5 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'}`} />
            <span className="flex-1">{it.label}</span>
            {count > 0 && (
              <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${it.badge === 'messages' ? 'bg-red-500 text-white' : active ? 'bg-white/20 text-white' : 'bg-brand-600 text-white'}`}>{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
