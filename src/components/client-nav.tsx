'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/app', label: 'Home', icon: 'M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z' },
  { href: '/app/workouts', label: 'Train', icon: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12' },
  { href: '/app/checkin', label: 'Check-in', icon: 'M9 12l2 2 4-4M5 4h14v16H5z' },
  { href: '/app/progress', label: 'Progress', icon: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6' },
  { href: '/app/messages', label: 'Coach', icon: 'M4 5h16v11H8l-4 4z' },
];

export function ClientNav({ unread }: { unread: number }) {
  const path = usePathname();
  if (path.startsWith('/app/onboarding')) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.href === '/app' ? path === '/app' : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-brand-700' : 'text-slate-500'}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
                {it.label}
                {it.href === '/app/messages' && unread > 0 && <span className="absolute right-4 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
