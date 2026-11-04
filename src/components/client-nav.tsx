'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';
import { useNavPath } from './nav-path';

const items = [
  { href: '/app', label: 'Home', icon: 'dashboard' },
  { href: '/app/workouts', label: 'Train', icon: 'dumbbell' },
  { href: '/app/checkin', label: 'Check-in', icon: 'checkins' },
  { href: '/app/progress', label: 'Progress', icon: 'trend' },
  { href: '/app/messages', label: 'Coach', icon: 'messages' },
];

export function ClientNav({ unread }: { unread: number }) {
  const realPath = usePathname();
  const { path, tap } = useNavPath();
  if (realPath.startsWith('/app/onboarding')) return null;
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-[#0c0d17]/95 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.href === '/app' ? path === '/app' : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} onClick={tap(it.href)} aria-current={active ? 'page' : undefined} className={`tap relative flex h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                <span className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-brand-50 text-brand-300' : ''}`}>
                  <Icon name={it.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.8} />
                  {it.href === '/app/messages' && unread > 0 && <span className="absolute right-1.5 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#0c0d17]" aria-label={`${unread} unread`} />}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
