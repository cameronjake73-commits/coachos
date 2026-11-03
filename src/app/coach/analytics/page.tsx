import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Card, EmptyState, Metric, PageHeader, RiskBadge } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { BarChart, LineChart } from '@/components/charts';
import { loadDashboard, revenueByMonth, weeklyEngagement } from '@/lib/dashboard-data';
import { gbp } from '@/lib/format';

export default async function Analytics() {
  const { supabase, coach } = await requireCoach();
  const d = await loadDashboard(supabase, coach.id, coach.checkin_day);
  const { data: all } = await supabase.from('clients').select('*').eq('coach_id', coach.id);
  const eng12 = weeklyEngagement(d.checkins, 12);
  const now = Date.now(), W = 7 * 86_400_000;
  const completion: number[] = [];
  for (let w = 11; w >= 0; w--) {
    const end = now - w * W, start = end - W;
    const activeThen = d.active.filter((c) => new Date(c.start_date ?? c.created_at).getTime() <= start).length || d.active.length || 1;
    const n = new Set(d.checkins.filter((c) => { const t = new Date(c.submitted_at).getTime(); return t > start && t <= end; }).map((c) => c.client_id)).size;
    completion.push(Math.min(100, Math.round((n / activeThen) * 100)));
  }
  const weekLabels = completion.map((_, i) => (i === 11 ? 'Now' : `${11 - i}w`));
  const rev = revenueByMonth((all ?? []) as typeof d.clients, 12);
  const risk = { high: d.active.filter((c) => c.risk_level === 'high').length, medium: d.active.filter((c) => c.risk_level === 'medium').length, low: d.active.filter((c) => c.risk_level === 'low').length };
  const avgFee = d.paying.length ? d.mrr / d.paying.length : 0;
  const atRisk = d.active.filter((c) => c.risk_level !== 'low').sort((a, b) => Number(b.monthly_fee ?? 0) - Number(a.monthly_fee ?? 0));

  if (!d.clients.length) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <PageHeader title="Analytics" />
        <Card><EmptyState icon="analytics" title="No data yet" action={<Link href="/coach/clients/new" className="btn-primary">Add a client</Link>}>Analytics fill in as your clients check in, train and pay.</EmptyState></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title="Analytics" description="Calculated from your clients' fees, check-ins and workouts." />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Metric label="Monthly revenue" icon="pound" tone="pink" value={gbp(d.mrr)} sub={`${d.paying.length} paying client${d.paying.length === 1 ? '' : 's'}`} />
        <Metric label="Average fee" icon="trend" value={gbp(avgFee)} sub="Per paying client" />
        <Metric label="Revenue at risk" icon="alert" tone="red" value={gbp(d.revenueAtRisk)} sub={`${risk.high} high-risk client${risk.high === 1 ? '' : 's'}`} />
        <Metric label="Retention" icon="retention" tone="green" value={d.stats.retention == null ? '—' : `${d.stats.retention}%`} sub="Clients still with you" />
      </div>

      <Card title="Engagement" description="Average training and nutrition adherence from check-ins, last 12 weeks">
        <LineChart width={1000} height={240} labels={weekLabels} current={eng12} />
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Monthly revenue" description="Based on client fees, start dates and archive dates">
          <BarChart values={rev.map((r) => r.value)} labels={rev.map((r) => r.label)} height={150} showLabels format={(v) => gbp(v)} />
        </Card>
        <Card title="Check-in completion" description="% of active clients who checked in each week">
          <BarChart values={completion} labels={weekLabels} height={150} showLabels format={(v) => `${v}%`} />
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Client risk">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {(['high', 'medium', 'low'] as const).map((k) => d.active.length ? <div key={k} style={{ width: `${(risk[k] / d.active.length) * 100}%` }} className={k === 'high' ? 'bg-red-500' : k === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'} /> : null)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-600">
            <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />At risk <span className="num text-slate-900">{risk.high}</span></span>
            <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />Watch <span className="num text-slate-900">{risk.medium}</span></span>
            <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />On track <span className="num text-slate-900">{risk.low}</span></span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 text-center">
            <div><div className="num text-xl font-semibold">{d.active.length}</div><div className="text-xs text-slate-500">Active</div></div>
            <div><div className="num text-xl font-semibold">{d.invited.length}</div><div className="text-xs text-slate-500">Invited</div></div>
            <div><div className="num text-xl font-semibold">{(all ?? []).filter((c) => c.status === 'archived').length}</div><div className="text-xs text-slate-500">Archived</div></div>
          </div>
        </Card>
        <Card title="Revenue at risk" description="Clients flagged Watch or At risk, by fee" flush>
          {!atRisk.length ? <div className="px-4 pb-4 md:px-5"><EmptyState compact icon="checkCircle" title="No revenue at risk" /></div> : (
            <ul className="divide-y divide-slate-200 border-t border-slate-200">
              {atRisk.slice(0, 6).map((c) => (
                <li key={c.id}><Link href={`/coach/clients/${c.id}`} className="row-link flex items-center gap-3 px-4 py-2.5 md:px-5">
                  <Avatar name={c.full_name} size={30} /><span className="min-w-0 flex-1 truncate text-sm">{c.full_name}</span><RiskBadge level={c.risk_level} /><span className="num w-14 text-right text-sm">{gbp(c.monthly_fee)}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
