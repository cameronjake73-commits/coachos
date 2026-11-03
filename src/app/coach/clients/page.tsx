import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, EmptyState, PageHeader, RiskBadge, Segmented, paymentTone, statusTone } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { AutoSubmitSelect, SearchInput } from '@/components/form-bits';
import { checkinStatus, type CheckinStatus } from '@/lib/coaching';
import { attentionScore } from '@/lib/dashboard-data';
import { gbp, shortDate, timeAgo } from '@/lib/format';
import type { Client } from '@/lib/types';
import { placesText } from '@/lib/plans';

const FILTERS = [
  ['current', 'All'], ['active', 'Active'], ['attention', 'Needs attention'], ['missed', 'Missed check-in'],
  ['renewing', 'Renewing soon'], ['overdue', 'Overdue'], ['invited', 'Invited'], ['paused', 'Paused'], ['archived', 'Archived'],
] as const;
type Filter = (typeof FILTERS)[number][0];

const SORTS = { name: 'Name', attention: 'Needs attention', renewal: 'Renewal date', fee: 'Fee', recent: 'Recently added' } as const;

function CheckinPill({ s }: { s?: CheckinStatus }) {
  if (!s) return <span className="text-slate-400">—</span>;
  if (s.state === 'submitted') return <Badge tone="green"><Icon name="check" className="h-3 w-3" strokeWidth={2.5} />Checked in</Badge>;
  if (s.state === 'missed') return <Badge tone="red">{s.missedCount > 1 ? `Missed ×${s.missedCount}` : 'Missed'}</Badge>;
  if (s.state === 'due') return <Badge tone="amber">Due</Badge>;
  return <Badge tone="slate">New</Badge>;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; sort?: string; focus?: string; show?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const filter: Filter = (FILTERS.map((f) => f[0]) as string[]).includes(sp.filter ?? '') ? (sp.filter as Filter) : sp.show === 'archived' ? 'archived' : 'current';
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : filter === 'attention' || filter === 'missed' ? 'attention' : filter === 'renewing' ? 'renewal' : 'name') as keyof typeof SORTS;
  const q = sp.q?.trim().replace(/[%,()*]/g, '') ?? '';

  const [{ data: rows }, { data: lastRows }] = await Promise.all([
    supabase.from('clients').select('*').eq('coach_id', coach.id),
    supabase.from('checkins').select('client_id, submitted_at').eq('coach_id', coach.id).order('submitted_at', { ascending: false }).limit(3000),
  ]);
  const all = (rows ?? []) as Client[];
  const lastBy = new Map<string, string>();
  for (const r of lastRows ?? []) if (!lastBy.has(r.client_id)) lastBy.set(r.client_id, r.submitted_at);
  const status = new Map<string, CheckinStatus>();
  for (const c of all) if (c.status === 'active') status.set(c.id, checkinStatus(c, lastBy.get(c.id), coach.checkin_day));

  const now = Date.now();
  const renewingSoon = (c: Client) => c.renewal_date != null && (new Date(c.renewal_date).getTime() - now) / 864e5 <= 14 && (new Date(c.renewal_date).getTime() - now) / 864e5 > -1;
  const needsAttention = (c: Client) => c.status === 'active' && (c.risk_level !== 'low' || status.get(c.id)?.state === 'missed' || c.payment_status === 'overdue');
  const match: Record<Filter, (c: Client) => boolean> = {
    current: (c) => c.status !== 'archived',
    active: (c) => c.status === 'active',
    attention: needsAttention,
    missed: (c) => status.get(c.id)?.state === 'missed',
    renewing: (c) => c.status === 'active' && renewingSoon(c),
    overdue: (c) => c.status !== 'archived' && c.payment_status === 'overdue',
    invited: (c) => c.status === 'invited',
    paused: (c) => c.status === 'paused',
    archived: (c) => c.status === 'archived',
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, all.filter(match[k]).length])) as Record<Filter, number>;

  let list = all.filter(match[filter]);
  if (q) { const n = q.toLowerCase(); list = list.filter((c) => c.full_name.toLowerCase().includes(n) || c.email.toLowerCase().includes(n) || (c.goal ?? '').toLowerCase().includes(n)); }
  const sorters: Record<keyof typeof SORTS, (a: Client, b: Client) => number> = {
    name: (a, b) => a.full_name.localeCompare(b.full_name),
    attention: (a, b) => attentionScore(b, status.get(b.id)) - attentionScore(a, status.get(a.id)),
    renewal: (a, b) => (a.renewal_date ?? '9999') < (b.renewal_date ?? '9999') ? -1 : 1,
    fee: (a, b) => Number(b.monthly_fee ?? 0) - Number(a.monthly_fee ?? 0),
    recent: (a, b) => (a.created_at < b.created_at ? 1 : -1),
  };
  list.sort(sorters[sort]);
  const used = all.filter((c) => c.status !== 'archived').length;
  const href = (f: Filter) => `/coach/clients?filter=${f}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Clients" description={placesText(used, coach.client_limit)}
        actions={<><Link href="/coach/clients/import" className="btn-secondary"><Icon name="arrowUp" className="h-4 w-4" />Import</Link><Link href="/coach/clients/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Add client</Link></>} />

      <div className="space-y-3">
        <form className="flex gap-2" role="search">
          <input type="hidden" name="filter" value={filter} />
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <SearchInput focus={sp.focus === 'search'} name="q" defaultValue={q} placeholder="Search by name, email or goal" aria-label="Search clients" className="input pl-9" />
          </div>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <AutoSubmitSelect id="sort" name="sort" defaultValue={sort} className="input w-auto max-w-[44%] md:max-w-none">
            {Object.entries(SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </AutoSubmitSelect>
        </form>
        <Segmented items={FILTERS.filter(([k]) => counts[k] > 0 || k === filter || ['current', 'active', 'archived'].includes(k)).map(([k, label]) => ({ href: href(k), label, active: filter === k, count: counts[k] }))} />
      </div>

      {used >= coach.client_limit && <Alert tone="amber" title="You've used all your client places" action={<Link href="/coach/billing" className="btn-secondary btn-sm">Upgrade</Link>}>Archive a client or move to a bigger plan to add more.</Alert>}

      {list.length === 0 ? (
        <Card>
          {all.length === 0 ? (
            <EmptyState icon="clients" title="No clients yet" action={<div className="flex flex-wrap justify-center gap-2"><Link href="/coach/clients/new" className="btn-primary"><Icon name="plus" className="h-4 w-4" />Add your first client</Link><Link href="/coach/clients/import" className="btn-secondary">Import from a spreadsheet</Link></div>}>
              Add a client and send them their invite link. They get their own app for workouts, check-ins and messages.
            </EmptyState>
          ) : <EmptyState icon="search" title={q ? `No clients match “${q}”` : 'No clients here'}>{filter !== 'current' && <Link href="/coach/clients" className="link">Show all clients</Link>}</EmptyState>}
        </Card>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid gap-2 md:grid-cols-2 lg:hidden">
            {list.map((c) => {
              const s = status.get(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/coach/clients/${c.id}`} className="card flex items-center gap-3 p-3.5 active:bg-raised">
                    <Avatar name={c.full_name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.full_name}</span>
                        {c.status === 'active' ? <RiskBadge level={c.risk_level} /> : <Badge tone={statusTone(c.status)}>{c.status}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {c.status === 'active' && <CheckinPill s={s} />}
                        {c.payment_status === 'overdue' && <Badge tone="red">Overdue</Badge>}
                        {c.monthly_fee ? <span className="num">{gbp(c.monthly_fee)}/mo</span> : null}
                        {c.renewal_date && c.status !== 'archived' && <span>Renews {shortDate(c.renewal_date)}</span>}
                      </div>
                    </div>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Tablet & desktop: table */}
          <Card flush className="hidden lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">This week</th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">Last check-in</th>
                  <th className="px-3 py-3 font-medium">Fee</th>
                  <th className="px-5 py-3 text-right font-medium">Renews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {list.map((c) => {
                  const s = status.get(c.id);
                  const last = lastBy.get(c.id);
                  return (
                    <tr key={c.id} className="row-link">
                      <td className="px-5 py-3">
                        <Link href={`/coach/clients/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={c.full_name} size={34} />
                          <span className="min-w-0"><span className="block truncate font-medium hover:underline">{c.full_name}</span><span className="block max-w-[260px] truncate text-xs text-slate-500">{c.goal || c.email}</span></span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.status === 'active' ? <RiskBadge level={c.risk_level} /> : <Badge tone={statusTone(c.status)}>{c.status}</Badge>}
                          {c.payment_status !== 'paid' && c.status !== 'archived' && <Badge tone={paymentTone(c.payment_status)}>{c.payment_status}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-3">{c.status === 'active' ? <CheckinPill s={s} /> : <span className="text-slate-400">—</span>}</td>
                      <td className="hidden px-3 py-3 text-slate-600 lg:table-cell">{last ? timeAgo(last) : '—'}</td>
                      <td className="num px-3 py-3">{c.monthly_fee ? gbp(c.monthly_fee) : '—'}</td>
                      <td className="num px-5 py-3 text-right text-slate-600">{c.status === 'archived' ? '—' : shortDate(c.renewal_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
