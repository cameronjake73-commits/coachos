import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { LineChart } from '@/components/charts';
import { SubmitButton } from '@/components/submit-button';
import { Alert, Badge, Card, CardLink, EmptyState, Metric, RiskBadge } from '@/components/ui';
import { generateBrief, refreshAllRisk } from './actions';
import { loadDashboard, recommendedAction } from '@/lib/dashboard-data';
import { DAYS, relativeDay } from '@/lib/coaching';
import { aiEnabled } from '@/lib/ai';
import { gbp, timeAgo } from '@/lib/format';
import { isUnlimited } from '@/lib/plans';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

type Task = { icon: string; tone: string; title: string; detail: string; href: string; cta: string };

export default async function CoachDashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach, user } = await requireCoach();
  const [{ data: profile }, d] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    loadDashboard(supabase, coach.id, coach.checkin_day),
  ]);
  const first = (profile?.full_name || '').split(' ')[0] || 'Coach';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });
  const ai = aiEnabled();
  const brief = coach.ai_brief && Date.now() - new Date(coach.ai_brief.generated_at).getTime() < 7 * 86_400_000 ? coach.ai_brief : null;
  const unreadTotal = [...d.unreadBy.values()].reduce((a, b) => a + b, 0);
  const noProgramme = d.active.filter((c) => !d.withProgramme.has(c.id));
  const renewalsThisWeek = d.renewals.filter((c) => (new Date(c.renewal_date!).getTime() - Date.now()) / 86_400_000 <= 7);
  const staleInvites = d.invited.filter((c) => Date.now() - new Date(c.created_at).getTime() > 3 * 86_400_000);

  const tasks: Task[] = [
    d.pendingReview.length && { icon: 'checkins', tone: 'bg-brand-50 text-brand-300', title: `Review ${d.pendingReview.length} check-in${d.pendingReview.length === 1 ? '' : 's'}`, detail: 'Oldest first. AI summaries are ready where available.', href: d.pendingReview.length ? `/coach/checkins/${d.pendingReview[d.pendingReview.length - 1].id}` : '/coach/checkins', cta: 'Start' },
    d.missed.length && { icon: 'missed', tone: 'bg-red-50 text-red-400', title: `Nudge ${d.missed.length} client${d.missed.length === 1 ? '' : 's'} who missed check-in`, detail: d.missed.slice(0, 3).map((c) => c.full_name.split(' ')[0]).join(', ') + (d.missed.length > 3 ? ` +${d.missed.length - 3}` : ''), href: '/coach/checkins?view=missed', cta: 'View' },
    unreadTotal && { icon: 'messages', tone: 'bg-sky-50 text-sky-400', title: `Reply to ${unreadTotal} message${unreadTotal === 1 ? '' : 's'}`, detail: `From ${d.unreadBy.size} client${d.unreadBy.size === 1 ? '' : 's'}`, href: '/coach/messages', cta: 'Open' },
    d.overdue.length && { icon: 'pound', tone: 'bg-amber-50 text-amber-400', title: `${d.overdue.length} overdue payment${d.overdue.length === 1 ? '' : 's'}`, detail: d.overdue.map((c) => c.full_name.split(' ')[0]).join(', '), href: '/coach/clients?filter=overdue', cta: 'View' },
    renewalsThisWeek.length && { icon: 'calendar', tone: 'bg-emerald-50 text-emerald-400', title: `${renewalsThisWeek.length} renewal${renewalsThisWeek.length === 1 ? '' : 's'} this week`, detail: gbp(renewalsThisWeek.reduce((s, c) => s + Number(c.monthly_fee || 0), 0)) + ' due', href: '/coach/clients?filter=renewing', cta: 'View' },
    noProgramme.length && { icon: 'programs', tone: 'bg-amber-50 text-amber-400', title: `${noProgramme.length} client${noProgramme.length === 1 ? ' has' : 's have'} no programme`, detail: noProgramme.slice(0, 3).map((c) => c.full_name.split(' ')[0]).join(', '), href: `/coach/clients/${noProgramme[0]?.id}?tab=training`, cta: 'Assign' },
    staleInvites.length && { icon: 'mail', tone: 'bg-sky-50 text-sky-400', title: `${staleInvites.length} invite${staleInvites.length === 1 ? '' : 's'} not accepted`, detail: 'Resend the link by DM or email', href: '/coach/clients?filter=invited', cta: 'View' },
  ].filter(Boolean) as Task[];

  const fallbackPriorities = d.attention.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-slate-500">{today}</p>
          <h1 className="mt-0.5 text-2xl md:text-[28px]">{greeting()}, {first}</h1>
        </div>
        <form action={refreshAllRisk}><SubmitButton className="btn-secondary btn-sm" pendingText="Refreshing…"><Icon name="refresh" className="h-4 w-4" />Refresh</SubmitButton></form>
      </div>
      {sp.error && <Alert tone="red">{sp.error}</Alert>}

      {d.clients.length === 0 ? (
        <Card>
          <EmptyState icon="clients" title="Add your first client" action={<Link href="/coach/clients/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Add client</Link>}>
            Add a client and send them their invite link. Their check-ins, workouts and messages will start appearing here.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <Metric label="Active clients" icon="clients" value={d.stats.active} href="/coach/clients"
              sub={<>{d.invited.length > 0 ? `${d.invited.length} invited · ` : ''}{isUnlimited(coach.client_limit) ? `${d.paying.length} paying` : `${coach.client_limit - d.clients.length} places free`}</>} />
            <Metric label="Monthly revenue" icon="pound" tone="pink" value={gbp(d.mrr)} href="/coach/analytics"
              sub={d.revenueAtRisk > 0 ? <span className="text-red-700">{gbp(d.revenueAtRisk)} at risk</span> : `${d.paying.length} paying client${d.paying.length === 1 ? '' : 's'}`} />
            <Metric label="Check-ins this week" icon="checkins" tone="blue" href="/coach/checkins"
              value={<>{d.submitted.length}<span className="text-lg text-slate-500">/{d.eligible.length}</span></>}
              sub={`Due ${relativeDay(d.cycle.due)}${d.stats.completion != null ? ` · ${d.stats.completion}% in` : ''}`} />
            <Metric label="Need attention" icon="alert" tone={d.atRisk.length ? 'red' : 'green'} value={d.attention.length} href="/coach/clients?filter=attention"
              sub={d.attention.length ? `${d.atRisk.length} at risk · ${d.missed.length} missed check-in` : 'Everyone is on track'} />
          </div>

          <div className="grid gap-5 md:gap-6 xl:grid-cols-5">
            <Card title="Today" description={tasks.length ? `${tasks.length} thing${tasks.length === 1 ? '' : 's'} to do` : undefined} className="xl:col-span-3" flush>
              {tasks.length === 0 ? (
                <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="checkCircle" title="You're all caught up">Nothing needs doing right now. New check-ins and messages will show up here.</EmptyState></div>
              ) : (
                <ul className="divide-y divide-slate-200 border-t border-slate-200">
                  {tasks.map((t) => (
                    <li key={t.title}>
                      <Link href={t.href} className="row-link flex items-center gap-3 px-4 py-3 md:px-5">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><Icon name={t.icon} className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-900">{t.title}</span>
                          <span className="block truncate text-[13px] text-slate-500">{t.detail}</span>
                        </span>
                        <span className="hidden text-[13px] font-medium text-brand-700 sm:inline">{t.cta}</span>
                        <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-[#1a1442] via-[#131530] to-surface p-4 shadow-glow md:p-5 xl:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2"><Icon name="sparkle" className="h-5 w-5 text-brand-300" />Weekly priorities</h2>
                {ai ? (
                  <form action={generateBrief}><SubmitButton className="btn-ghost btn-sm text-brand-100" pendingText="Thinking…">{brief ? 'Regenerate' : 'Generate'}</SubmitButton></form>
                ) : <Badge tone="slate">AI off</Badge>}
              </div>
              {brief ? (
                <>
                  <p className="mt-2 text-[13px] text-slate-700">{brief.headline}</p>
                  <ol className="mt-3 space-y-2.5">
                    {brief.priorities.slice(0, 4).map((p, i) => (
                      <li key={p.client_id + i} className="rounded-xl border border-slate-200 bg-[#0c0e18]/70 p-3">
                        <Link href={`/coach/clients/${p.client_id}`} className="flex items-center gap-2 font-medium hover:underline"><Avatar name={p.name} size={22} />{p.name}</Link>
                        <p className="mt-1.5 text-[13px] text-slate-700"><span className="eyebrow mr-1.5">Data</span>{p.observation}</p>
                        <p className="mt-1 text-[13px] text-slate-700"><span className="eyebrow mr-1.5 text-brand-300">Idea</span>{p.suggestion}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-2xs text-slate-500">AI summary of your client data, {timeAgo(brief.generated_at)}. Suggestions only. You decide.</p>
                </>
              ) : fallbackPriorities.length ? (
                <>
                  <p className="mt-2 text-[13px] text-slate-600">Ranked from check-ins, workouts, payments and renewals.</p>
                  <ol className="mt-3 space-y-2.5">
                    {fallbackPriorities.map(({ c, s }) => (
                      <li key={c.id} className="rounded-xl border border-slate-200 bg-[#0c0e18]/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/coach/clients/${c.id}`} className="flex min-w-0 items-center gap-2 font-medium hover:underline"><Avatar name={c.full_name} size={22} /><span className="truncate">{c.full_name}</span></Link>
                          <RiskBadge level={c.risk_level} />
                        </div>
                        <p className="mt-1.5 text-[13px] text-slate-700"><span className="eyebrow mr-1.5">Data</span>{s?.state === 'missed' ? (s.missedCount > 1 ? `Missed ${s.missedCount} check-ins. ` : 'Missed this week’s check-in. ') : ''}{c.risk_reasons.slice(0, 2).join('. ') || (c.payment_status === 'overdue' ? 'Payment overdue.' : '')}</p>
                        <p className="mt-1 text-[13px] text-slate-700"><span className="eyebrow mr-1.5 text-brand-300">Idea</span>{recommendedAction(c, s)}</p>
                      </li>
                    ))}
                  </ol>
                  {!ai && <p className="mt-3 text-2xs text-slate-500">Connect AI in Settings for a written weekly brief.</p>}
                </>
              ) : (
                <p className="mt-3 text-[13px] text-slate-600">No one needs urgent attention. Priorities appear here when check-ins, workouts or payments start slipping.</p>
              )}
            </section>
          </div>

          <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
            <Card title="Clients needing attention" action={<CardLink href="/coach/clients?filter=attention">View all</CardLink>} flush>
              {d.attention.length === 0 ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="checkCircle" title="Everyone is on track" /></div> : (
                <ul className="divide-y divide-slate-200 border-t border-slate-200">
                  {d.attention.slice(0, 5).map(({ c, s }) => {
                    const reason = c.payment_status === 'overdue' ? 'Payment overdue' : s?.state === 'missed' ? (s.missedCount > 1 ? `Missed ${s.missedCount} check-ins` : 'Missed this week’s check-in') : c.risk_reasons[0] ?? 'Engagement dipping';
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                        <Avatar name={c.full_name} size={36} />
                        <Link href={`/coach/clients/${c.id}`} className="min-w-0 flex-1">
                          <span className="block truncate font-medium hover:underline">{c.full_name}</span>
                          <span className="block truncate text-[13px] text-slate-500">{reason}</span>
                        </Link>
                        <RiskBadge level={c.risk_level} />
                        <Link href={`/coach/clients/${c.id}?tab=messages&draft=1`} className="btn-secondary btn-sm hidden sm:inline-flex">Message</Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Upcoming renewals" description="Next 14 days" action={<CardLink href="/coach/clients?filter=renewing">View all</CardLink>} flush>
              {d.renewals.length === 0 ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="calendar" title="No renewals in the next 14 days" /></div> : (
                <ul className="divide-y divide-slate-200 border-t border-slate-200">
                  {d.renewals.slice(0, 5).map((c) => {
                    const n = Math.ceil((new Date(c.renewal_date!).getTime() - Date.now()) / 86_400_000);
                    return (
                      <li key={c.id}>
                        <Link href={`/coach/clients/${c.id}`} className="row-link flex items-center gap-3 px-4 py-3 md:px-5">
                          <Avatar name={c.full_name} size={36} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 truncate font-medium">{c.full_name}{c.risk_level === 'high' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="At risk" />}</span>
                            <span className="block text-[13px] text-slate-500">{n <= 0 ? 'Renews today' : `Renews in ${n} day${n === 1 ? '' : 's'}`}{c.payment_status !== 'paid' ? ` · ${c.payment_status}` : ''}</span>
                          </span>
                          <span className="num text-sm font-medium text-slate-800">{c.monthly_fee ? gbp(c.monthly_fee) : '—'}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-5 md:gap-6 xl:grid-cols-5">
            <Card title="Client engagement" description="Average training and nutrition adherence from check-ins" className="xl:col-span-3"
              action={<div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" />Last 4 weeks</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-slate-400" />Previous</span></div>}>
              <LineChart labels={['4 wks ago', '3 wks ago', '2 wks ago', 'This week']} current={d.engagement.current} previous={d.engagement.previous} />
            </Card>

            <Card title="Recent activity" className="xl:col-span-2" flush>
              {d.activity.length === 0 ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="inbox" title="No activity yet">Check-ins, workouts and messages from clients appear here.</EmptyState></div> : (
                <ul className="divide-y divide-slate-200 border-t border-slate-200">
                  {d.activity.map((a, i) => (
                    <li key={i}>
                      <Link href={a.href} className="row-link flex items-center gap-3 px-4 py-2.5 md:px-5">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.kind === 'checkin' ? 'bg-emerald-50 text-emerald-400' : a.kind === 'workout' ? 'bg-brand-50 text-brand-300' : 'bg-sky-50 text-sky-400'}`}>
                          <Icon name={a.kind === 'checkin' ? 'check' : a.kind === 'workout' ? 'dumbbell' : 'messages'} className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800">{a.text}</span>
                        <span className="shrink-0 text-xs text-slate-500">{timeAgo(a.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <p className="text-center text-xs text-slate-500">Check-ins are due every {DAYS[coach.checkin_day]}. Change this in <Link href="/coach/settings" className="link">Settings</Link>.</p>
        </>
      )}
    </div>
  );
}
