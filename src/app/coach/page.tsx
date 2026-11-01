import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { BarChart, Donut, LineChart } from '@/components/charts';
import { SubmitButton } from '@/components/submit-button';
import { refreshAllRisk } from './actions';
import { loadDashboard, recommendedAction } from '@/lib/dashboard-data';
import { daysSince, daysUntil, gbp, timeAgo } from '@/lib/format';
import type { Client } from '@/lib/types';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-xs text-slate-500">{suffix || ' '}</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-emerald-700' : 'text-red-700'}`}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} className="h-3.5 w-3.5" strokeWidth={2.4} />{up ? '+' : ''}{value}%
      {suffix && <span className="font-normal text-slate-500">{suffix}</span>}
    </span>
  );
}

function StatCard({ icon, tone, label, value, children }: { icon: React.ReactNode; tone: string; label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-5 p-5">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-sm text-slate-600">{label}</div>
        <div className="mt-0.5 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'red' | 'orange' | 'blue' | 'purple'; children: React.ReactNode }) {
  const t = { red: 'bg-red-600 text-white', orange: 'bg-amber-600 text-white', blue: 'bg-sky-600 text-white', purple: 'bg-brand-600 text-white' }[tone];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${t}`}>{children}</span>;
}

function attentionMeta(c: Client, lastCheckin: string | undefined) {
  const since = daysSince(lastCheckin);
  if (c.payment_status === 'overdue') return { pill: <Pill tone="blue">Overdue</Pill>, sub: 'Payment overdue', action: 'Message', href: `/coach/clients/${c.id}?tab=messages&draft=1` };
  if (c.risk_level === 'high') return { pill: <Pill tone="red">At Risk</Pill>, sub: since != null && since >= 8 ? `Last check-in ${since}d ago` : c.risk_reasons[0] ?? 'Engagement dropping', action: 'Contact', href: `/coach/clients/${c.id}?tab=messages&draft=1` };
  return { pill: <Pill tone="orange">Needs Attention</Pill>, sub: c.risk_reasons[0] ?? 'Engagement dipping', action: 'Review', href: `/coach/clients/${c.id}` };
}

export default async function CoachDashboard() {
  const { supabase, coach, user } = await requireCoach();
  const [{ data: profile }, d] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    loadDashboard(supabase, coach.id),
  ]);
  const first = (profile?.full_name || 'Coach').split(' ')[0];
  const lastBy = new Map<string, string>();
  for (const c of d.checkins) if (!lastBy.has(c.client_id)) lastBy.set(c.client_id, c.submitted_at);

  const attention = d.active.filter((c) => c.risk_level !== 'low' || c.payment_status === 'overdue').slice(0, 5);
  const top = d.active.find((c) => c.risk_level === 'high') ?? attention[0];
  const renewals = d.active.filter((c) => { const n = daysUntil(c.renewal_date); return n != null && n >= 0 && n <= 30; })
    .sort((a, b) => (a.renewal_date! < b.renewal_date! ? -1 : 1)).slice(0, 5);
  const growth = d.stats.mrrDelta;
  const weekLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const pendingCount = d.checkins.filter((c) => c.status === 'submitted').length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl">{greeting()}, {first} <span aria-hidden>👋</span></h1>
          <p className="mt-1.5 text-slate-600">Here&apos;s what&apos;s happening with your coaching business today.</p>
        </div>
        <form action={refreshAllRisk}><SubmitButton className="btn-secondary" pendingText="Refreshing…">Refresh insights</SubmitButton></form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Clients" value={d.stats.active} tone="bg-brand-50 text-brand-400" icon={<Icon name="clients" className="h-7 w-7" />}>
          <Delta value={d.stats.activeDelta} suffix={d.stats.activeDelta == null ? `of ${coach.client_limit} places` : ''} />
        </StatCard>
        <StatCard label="Client Retention" value={d.stats.retention == null ? '—' : `${d.stats.retention}%`} tone="bg-emerald-50"
          icon={<Donut value={d.stats.retention ?? 0} size={40} />}>
          <span className="text-xs text-slate-500">of clients still with you</span>
        </StatCard>
        <StatCard label="Check-ins This Week" value={<>{d.stats.checkedThisWeek} <span className="text-slate-500">/</span> {d.stats.active}</>} tone="bg-sky-50 text-sky-400" icon={<Icon name="calendar" className="h-7 w-7" />}>
          <Delta value={d.stats.checkinDelta} suffix={d.stats.checkinDelta == null ? `${pendingCount} to review` : ''} />
        </StatCard>
        <StatCard label="Monthly Revenue" value={gbp(d.stats.mrr)} tone="bg-[rgba(236,72,153,0.14)] text-pink-400" icon={<Icon name="pound" className="h-7 w-7" strokeWidth={2.2} />}>
          <Delta value={d.stats.mrrDelta} suffix={d.stats.mrrDelta == null ? 'from client fees' : ' vs 3 mo'} />
        </StatCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2>Client Engagement</h2>
            <div className="flex items-center gap-5 text-sm text-slate-600">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />Last 4 weeks</span>
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Previous 4 weeks</span>
            </div>
          </div>
          <LineChart labels={weekLabels} current={d.engagement.current} previous={d.engagement.previous} />
          <p className="text-xs text-slate-500">Average of training and nutrition adherence from client check-ins.</p>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-[#1d1650] via-[#151a3c] to-surface p-6 shadow-glow">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2"><Icon name="sparkle" className="h-6 w-6 text-brand-300" /> AI Insights</h2>
            {top && <Link href={`/coach/clients/${top.id}`} className="flex items-center gap-1 text-sm link">View details <Icon name="arrowRight" className="h-4 w-4" /></Link>}
          </div>
          {top ? (
            <>
              <span className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${top.risk_level === 'high' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                <Icon name="alert" className="h-4 w-4" /> {top.risk_level === 'high' ? 'Attention Needed' : 'Worth a look'}
              </span>
              <p className="mt-3 text-[17px] leading-snug text-slate-900">
                <strong>{top.full_name}</strong>{"'s engagement is slipping"}
                {top.risk_reasons.length ? `: ${top.risk_reasons.slice(0, 2).map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join(' and ')}.` : '.'}
              </p>
              <div className="mt-5 text-sm font-semibold text-slate-900">Recommended action:</div>
              <div className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-[#0e1328]/70 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-300"><Icon name="messages" className="h-5 w-5" /></span>
                <p className="text-sm text-slate-700">{recommendedAction(top)}</p>
              </div>
              <Link href={`/coach/clients/${top.id}?tab=messages&draft=1`} className="btn-primary mt-4 w-full py-2.5">Draft message <Icon name="sparkle" className="h-4 w-4" /></Link>
            </>
          ) : (
            <p className="mt-4 text-slate-600">No one needs urgent attention. Insights appear here when a client&apos;s check-ins, workouts or payments start slipping.</p>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2>Clients Needing Attention</h2>
            <Link href="/coach/clients" className="flex items-center gap-1 text-sm link">View all <Icon name="arrowRight" className="h-4 w-4" /></Link></div>
          {attention.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Everyone is on track.</p> : (
            <ul className="space-y-1">
              {attention.map((c) => {
                const m = attentionMeta(c, lastBy.get(c.id));
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <Avatar name={c.full_name} size={38} />
                    <Link href={`/coach/clients/${c.id}`} className="min-w-0 flex-1">
                      <div className="truncate font-medium hover:underline">{c.full_name}</div>
                      <div className="truncate text-sm text-slate-500">{m.sub}</div>
                    </Link>
                    {m.pill}
                    <Link href={m.href} className="btn-secondary px-3 py-1.5 text-xs">{m.action}</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between"><h2>Upcoming Renewals</h2>
            <Link href="/coach/clients" className="flex items-center gap-1 text-sm link">View all <Icon name="arrowRight" className="h-4 w-4" /></Link></div>
          {renewals.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No renewals in the next 30 days.</p> : (
            <ul className="space-y-1">
              {renewals.map((c) => {
                const n = daysUntil(c.renewal_date)!;
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2">
                    <Avatar name={c.full_name} size={38} />
                    <Link href={`/coach/clients/${c.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate font-medium hover:underline">{c.full_name}
                        {c.risk_level === 'high' && <span className="h-2 w-2 rounded-full bg-red-500" title="At risk" />}</div>
                      <div className="text-sm text-slate-500">Renews {n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`}</div>
                    </Link>
                    <span className="text-sm font-medium text-slate-800">{c.monthly_fee ? `${gbp(c.monthly_fee)}/month` : '—'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card flex flex-col">
          <h2>Your Business Growth</h2>
          <div className="mt-4 flex flex-1 flex-col justify-between gap-5">
            <div>
              {growth != null ? (
                <div className={`flex items-center gap-2 text-4xl font-bold ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <Icon name={growth >= 0 ? 'trend' : 'arrowDown'} className="h-8 w-8" strokeWidth={2.4} />{growth >= 0 ? '+' : ''}{growth}%
                </div>
              ) : <div className="text-4xl font-bold">{gbp(d.mrr)}</div>}
              <div className="mt-1 text-sm text-slate-600">{growth != null ? 'monthly revenue vs 3 months ago' : 'monthly revenue'}</div>
            </div>
            <BarChart values={d.revenue.map((r) => r.value)} labels={d.revenue.map((r) => r.label)} height={110} showLabels />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <div className="mb-3 flex items-center justify-between"><h2>Recent Activity</h2>
            <Link href="/coach/checkins" className="flex items-center gap-1 text-sm link">View all <Icon name="arrowRight" className="h-4 w-4" /></Link></div>
          {d.activity.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Activity from your clients will appear here.</p> : (
            <ul className="divide-y divide-slate-200">
              {d.activity.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center gap-3 py-2.5 hover:text-slate-900">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.kind === 'checkin' ? 'bg-emerald-50 text-emerald-400' : a.kind === 'workout' ? 'bg-brand-50 text-brand-300' : 'bg-[rgba(236,72,153,0.14)] text-pink-400'}`}>
                      <Icon name={a.kind === 'checkin' ? 'check' : a.kind === 'workout' ? 'dumbbell' : 'mail'} className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-slate-800">{a.text}</span>
                    <span className="shrink-0 text-sm text-slate-500">{timeAgo(a.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-[#1b1450] via-[#161a3d] to-[#2a1a73] p-7 xl:col-span-2">
          <svg className="pointer-events-none absolute -right-6 -top-6 h-[140%] w-2/3 opacity-60" viewBox="0 0 200 200" aria-hidden>
            <defs><linearGradient id="pr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity="0" /><stop offset="1" stopColor="#9a83ff" stopOpacity="0.9" /></linearGradient></defs>
            {[0, 1, 2, 3].map((i) => <path key={i} d={`M${20 + i * 30} 200 L${200} ${20 + i * 25}`} stroke="url(#pr)" strokeWidth={i === 1 ? 3 : 1} />)}
            <circle cx="150" cy="70" r="46" fill="#7c5cff" opacity="0.18" /><circle cx="170" cy="120" r="24" fill="#9a83ff" opacity="0.25" />
          </svg>
          <div className="relative max-w-sm">
            {coach.plan === 'pro' ? (
              <>
                <h2 className="text-xl">Grow your coaching business</h2>
                <p className="mt-2 text-sm text-slate-700">You have {coach.client_limit - d.clients.length} client places free. Invite your next client and they&apos;ll have their app in minutes.</p>
                <Link href="/coach/clients" className="btn-primary mt-5">Invite a client <Icon name="arrowRight" className="h-4 w-4" /></Link>
              </>
            ) : (
              <>
                <h2 className="text-xl">Grow your coaching business</h2>
                <p className="mt-2 text-sm text-slate-700">Coach up to 75 clients with every feature included: AI check-ins, retention insights and your client app.</p>
                <Link href="/coach/billing" className="btn-primary mt-5">{coach.plan === 'trial' ? 'See plans' : 'Explore Pro'} <Icon name="arrowRight" className="h-4 w-4" /></Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
