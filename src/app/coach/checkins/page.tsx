import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, EmptyState, PageHeader, RiskBadge, Tabs } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { checkinCycle, checkinStatus, DAYS, relativeDay, type CheckinStatus } from '@/lib/coaching';
import { longDate, shortDate, timeAgo } from '@/lib/format';
import type { Client, RiskLevel } from '@/lib/types';

type View = 'review' | 'missed' | 'waiting' | 'reviewed';

export default async function CheckinsPage({ searchParams }: { searchParams: Promise<{ done?: string; view?: string }> }) {
  const sp = await searchParams;
  const view: View = (['review', 'missed', 'waiting', 'reviewed'] as const).includes(sp.view as View) ? (sp.view as View) : 'review';
  const { supabase, coach } = await requireCoach();
  const [{ data: pending }, { data: reviewed }, { data: clientsRaw }, { data: lastRows }] = await Promise.all([
    supabase.from('checkins').select('id, submitted_at, training_adherence, nutrition_adherence, weight_kg, ai_analysis, clients(id, full_name, risk_level)').eq('coach_id', coach.id).eq('status', 'submitted').order('submitted_at').limit(200),
    view === 'reviewed'
      ? supabase.from('checkins').select('id, submitted_at, replied_at, coach_reply, training_adherence, nutrition_adherence, weight_kg, clients(id, full_name, risk_level)').eq('coach_id', coach.id).eq('status', 'reviewed').order('submitted_at', { ascending: false }).limit(60)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('clients').select('*').eq('coach_id', coach.id).eq('status', 'active').order('full_name'),
    supabase.from('checkins').select('client_id, submitted_at').eq('coach_id', coach.id).order('submitted_at', { ascending: false }).limit(3000),
  ]);
  const clients = (clientsRaw ?? []) as Client[];
  const lastBy = new Map<string, string>();
  for (const r of lastRows ?? []) if (!lastBy.has(r.client_id)) lastBy.set(r.client_id, r.submitted_at);
  const st = new Map<string, CheckinStatus>(clients.map((c) => [c.id, checkinStatus(c, lastBy.get(c.id), coach.checkin_day)]));
  const missed = clients.filter((c) => st.get(c.id)?.state === 'missed').sort((a, b) => (st.get(b.id)!.missedCount - st.get(a.id)!.missedCount));
  const waiting = clients.filter((c) => st.get(c.id)?.state === 'due');
  const submittedCount = clients.filter((c) => st.get(c.id)?.state === 'submitted').length;
  const eligible = clients.filter((c) => st.get(c.id)?.state !== 'new').length;
  const cycle = checkinCycle(coach.checkin_day);
  const pend = pending ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Check-ins"
        description={<>Due every {DAYS[coach.checkin_day]} · this week: <span className="num text-slate-800">{submittedCount}/{eligible}</span> in, due {relativeDay(cycle.due)}</>}
        actions={pend.length > 0 && <Link href={`/coach/checkins/${pend[0].id}`} className="btn-primary"><Icon name="checkins" className="h-4 w-4" />Start reviewing</Link>} />
      {sp.done && <Alert tone="green" title="All check-ins reviewed">Nice work. Your clients have their feedback.</Alert>}

      <Tabs items={[
        { href: '/coach/checkins', label: 'To review', active: view === 'review', count: pend.length },
        { href: '/coach/checkins?view=missed', label: 'Missed', active: view === 'missed', count: missed.length },
        { href: '/coach/checkins?view=waiting', label: 'Not in yet', active: view === 'waiting', count: waiting.length },
        { href: '/coach/checkins?view=reviewed', label: 'Reviewed', active: view === 'reviewed' },
      ]} />

      {view === 'review' && (
        <Card flush>
          {!pend.length ? <div className="p-4"><EmptyState icon="checkCircle" title="Nothing waiting for review">New check-ins land here as soon as clients submit them.</EmptyState></div> : (
            <ul className="divide-y divide-slate-200">
              {pend.map((c) => {
                const cl = c.clients as unknown as { id: string; full_name: string; risk_level: RiskLevel };
                const ai = c.ai_analysis as { summary?: string; engagement?: string } | null;
                return (
                  <li key={c.id}>
                    <Link href={`/coach/checkins/${c.id}`} className="row-link flex items-start gap-3 px-4 py-3.5 md:px-5">
                      <Avatar name={cl?.full_name ?? '?'} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{cl?.full_name}</span>
                          {cl?.risk_level && cl.risk_level !== 'low' && <RiskBadge level={cl.risk_level} />}
                          {ai?.engagement === 'declining' && <Badge tone="red">Declining</Badge>}
                        </div>
                        <div className="num mt-0.5 text-xs text-slate-500">{c.weight_kg ? `${c.weight_kg}kg · ` : ''}Training {c.training_adherence ?? '—'}% · Nutrition {c.nutrition_adherence ?? '—'}%</div>
                        {ai?.summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-slate-600"><Icon name="sparkle" className="mr-1 inline h-3.5 w-3.5 text-brand-300" />{ai.summary}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">{timeAgo(c.submitted_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {(view === 'missed' || view === 'waiting') && (
        <Card flush>
          {(view === 'missed' ? missed : waiting).length === 0 ? (
            <div className="p-4"><EmptyState icon="checkCircle" title={view === 'missed' ? 'No missed check-ins' : 'Everyone due has checked in'} /></div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {(view === 'missed' ? missed : waiting).map((c) => {
                const s = st.get(c.id)!;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                    <Avatar name={c.full_name} size={38} />
                    <Link href={`/coach/clients/${c.id}?tab=check-ins`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium hover:underline">{c.full_name}</span>
                      <span className="block truncate text-xs text-slate-500">{s.lastAt ? `Last check-in ${longDate(s.lastAt)}` : 'No check-ins yet'}{c.email_reminders ? ' · reminder emails on' : ''}</span>
                    </Link>
                    {view === 'missed' && <Badge tone={s.missedCount > 1 ? 'red' : 'amber'}>{s.missedCount > 1 ? `${s.missedCount} in a row` : 'Missed'}</Badge>}
                    <Link href={`/coach/clients/${c.id}?tab=messages&draft=1`} className="btn-secondary btn-sm">Nudge</Link>
                  </li>
                );
              })}
            </ul>
          )}
          {view === 'waiting' && <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 md:px-5">Clients can check in from {DAYS[(coach.checkin_day + 4) % 7]}. Anyone still not in after {DAYS[coach.checkin_day]} moves to Missed.</p>}
        </Card>
      )}

      {view === 'reviewed' && (
        <Card flush>
          {!reviewed?.length ? <div className="p-4"><EmptyState icon="checkins" title="No reviewed check-ins yet" /></div> : (
            <ul className="divide-y divide-slate-200">
              {reviewed.map((c) => {
                const cl = c.clients as unknown as { id: string; full_name: string };
                return (
                  <li key={c.id}>
                    <Link href={`/coach/checkins/${c.id}`} className="row-link flex items-center gap-3 px-4 py-3 md:px-5">
                      <Avatar name={cl?.full_name ?? '?'} size={34} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{cl?.full_name}</span><span className="block truncate text-xs text-slate-500">{c.coach_reply ? `Replied: ${c.coach_reply.replace(/\s+/g, ' ')}` : 'Marked reviewed without reply'}</span></span>
                      <span className="shrink-0 text-xs text-slate-500">{shortDate(c.submitted_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
