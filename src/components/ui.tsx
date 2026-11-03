import Link from 'next/link';
import type { RiskLevel } from '@/lib/types';
import { Icon } from './icons';

/* ------------------------------------------------------------------ layout */

export function PageHeader({ title, description, back, actions, children }: {
  title: React.ReactNode; description?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link href={back.href} className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] text-slate-500 transition hover:text-slate-800">
          <Icon name="chevronLeft" className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Card({ title, description, action, children, className = '', flush = false }: {
  title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  const head = (title || action) && (
    <div className={`flex items-start justify-between gap-3 ${flush ? 'px-4 pt-4 md:px-5 md:pt-5' : ''} mb-3`}>
      <div className="min-w-0">
        {title && <h2>{title}</h2>}
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
  return (
    <section className={`${flush ? 'card-flush overflow-hidden' : 'card'} ${className}`}>
      {head}
      {children}
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-[13px] link">{children}<Icon name="arrowRight" className="h-3.5 w-3.5" /></Link>;
}

/* ------------------------------------------------------------------ navigation */

export function Tabs({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav className="scroll-x -mx-4 gap-1 border-b border-slate-200 px-4 md:mx-0 md:px-0" aria-label="Sections">
      {items.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.active ? 'page' : undefined}
          className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-2 px-3 text-sm font-medium transition md:min-h-[40px] ${t.active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
          {t.label}
          {t.count != null && t.count > 0 && <span className={`num rounded-full px-1.5 text-2xs font-semibold leading-5 ${t.active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.count}</span>}
          {t.active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />}
        </Link>
      ))}
    </nav>
  );
}

export function Segmented({ items }: { items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <div className="scroll-x gap-1.5">
      {items.map((t) => (
        <Link key={t.href} href={t.href}
          className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition md:min-h-[30px] ${t.active ? 'border-brand-500/60 bg-brand-50 text-brand-100' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}>
          {t.label}{t.count != null && <span className="num text-slate-500">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ status */

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-red-50 text-red-700 ring-red-200',
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const label = level === 'high' ? 'At risk' : level === 'medium' ? 'Watch' : 'On track';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${riskStyles[level]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {label}{score != null && score > 0 && <span className="num opacity-60">{score}</span>}
    </span>
  );
}

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand';
const toneClass: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-300/50',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass[tone]}`}>{children}</span>;
}

export const statusTone = (s: string): Tone => (s === 'active' ? 'green' : s === 'invited' ? 'blue' : s === 'paused' ? 'amber' : 'slate');
export const paymentTone = (s: string): Tone => (s === 'paid' ? 'green' : s === 'overdue' ? 'red' : s === 'due' ? 'amber' : 'slate');

export function Alert({ tone = 'blue', title, children, action }: { tone?: 'blue' | 'green' | 'amber' | 'red' | 'brand'; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  const t = {
    blue: 'border-sky-200 bg-sky-50 text-sky-800', green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800', red: 'border-red-200 bg-red-50 text-red-800', brand: 'border-brand-200 bg-brand-50 text-brand-100',
  }[tone];
  const icon = tone === 'green' ? 'checkCircle' : tone === 'red' || tone === 'amber' ? 'alert' : tone === 'brand' ? 'sparkle' : 'info';
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${t}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ data display */

export function Metric({ label, value, sub, icon, tone = 'brand', href }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: string; tone?: 'brand' | 'green' | 'blue' | 'pink' | 'amber' | 'red'; href?: string;
}) {
  const t = { brand: 'bg-brand-50 text-brand-300', green: 'bg-emerald-50 text-emerald-400', blue: 'bg-sky-50 text-sky-400', pink: 'bg-pink-50 text-pink-400', amber: 'bg-amber-50 text-amber-400', red: 'bg-red-50 text-red-400' }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-slate-500">{label}</span>
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t}`}><Icon name={icon} className="h-4 w-4" /></span>}
      </div>
      <div className="num mt-2 text-2xl font-semibold tracking-tight md:text-[28px]">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </>
  );
  return href
    ? <Link href={href} className="card block transition hover:border-slate-300">{body}</Link>
    : <div className="card">{body}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="num mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Delta({ value, unit = '', goodWhen, digits = 1 }: { value: number | null | undefined; unit?: string; goodWhen?: 'up' | 'down'; digits?: number }) {
  if (value == null || Number.isNaN(value)) return <span className="text-slate-400">—</span>;
  const v = Number(value.toFixed(digits));
  if (v === 0) return <span className="num text-slate-500">±0{unit}</span>;
  const good = goodWhen ? (v > 0) === (goodWhen === 'up') : null;
  return <span className={`num font-medium ${good == null ? 'text-slate-700' : good ? 'text-emerald-700' : 'text-red-700'}`}>{v > 0 ? '+' : ''}{v}{unit}</span>;
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'green' | 'amber' | 'red' }) {
  const t = { brand: 'bg-brand-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' }[tone];
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${t}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function EmptyState({ icon = 'inbox', title, children, action, compact = false }: { icon?: string; title: string; children?: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6' : 'py-10'}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/60 text-slate-500"><Icon name={icon} className="h-5 w-5" /></span>
      <div className="mt-3 font-medium text-slate-800">{title}</div>
      {children && <p className="mt-1 max-w-sm text-[13px] text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** @deprecated use EmptyState */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">{children}</div>;
}

export function KeyValue({ items, cols = 2 }: { items: [string, React.ReactNode][]; cols?: 1 | 2 | 3 }) {
  const c = cols === 1 ? '' : cols === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${c}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 break-words text-sm text-slate-800">{v ?? '—'}</dd></div>
      ))}
    </dl>
  );
}

/** Tiny dependency-free line chart. */
export function Sparkline({ values, height = 48, unit = '' }: { values: (number | null)[]; height?: number; unit?: string }) {
  const pts = values.map((v, i) => ({ v: v == null ? null : Number(v), i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <div className="text-xs text-slate-400">Not enough data yet</div>;
  const w = 240;
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (w - 8) + 4;
  const y = (v: number) => height - 6 - ((v - min) / span) * (height - 12);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-10 w-full max-w-[240px]" preserveAspectRatio="none" aria-hidden>
        <path d={d} fill="none" stroke="#8b6cff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(last.i)} cy={y(last.v)} r="3" fill="#8b6cff" />
      </svg>
      <span className="num whitespace-nowrap text-sm font-medium">{last.v}{unit}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({ label, hint, children, className = '' }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-brand-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400" />
      <span className="text-sm"><span className="text-slate-800">{label}</span>{description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}</span>
    </label>
  );
}
