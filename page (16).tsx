import { requireCoach } from '@/lib/auth';
import { Card, Stat } from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';
import { loadDashboard, revenueByMonth, weeklyEngagement } from '@/lib/dashboard-data';
import { gbp } from '@/lib/format';

export default async function Analytics() {
  const { supabase, coach } = await requireCoach();
  const d = await loadDashboard(supabase, coach.id);
  const since12 = new Date(Date.now() - 12 * 7 * 86_400_000).toISOString();
  const { data: cis12 } = await supabase.from('checkins').select('id, client_id, submitted_at, training_adherence, nutrition_adherence, status').eq('coach_id', coach.id).gte('submitted_at', since12);
  const checkins = cis12 ?? [];
  const eng12 = weeklyEngagement(checkins, 12);
  const completion: number[] = [];
  const now = Date.now(), W = 7 * 86_400_000;
  for (let w = 11; w >= 0; w--) {
    const end = now - w * W, start = end - W;
    completion.push(new Set(checkins.filter((c) => { const t = new Date(c.submitted_at).getTime(); return t > start && t <= end; }).map((c) => c.client_id)).size);
  }
  const rev = revenueByMonth(d.clients, 12);
  const risk = { high: d.active.filter((c) => c.risk_level === 'high').length, medium: d.active.filter((c) => c.risk_level === 'medium').length, low: d.active.filter((c) => c.risk_level === 'low').length };
  const avgFee = d.active.length ? d.mrr / d.active.length : 0;
  const revenueAtRisk = d.active.filter((c) => c.risk_level === 'high').reduce((s, c) => s + Number(c.monthly_fee || 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1>Analytics</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Monthly revenue" value={gbp(d.mrr)} hint="From fees on active clients" />
        <Stat label="Average fee" value={gbp(avgFee)} hint="Per active client" />
        <Stat label="Revenue at risk" value={gbp(revenueAtRisk)} hint={`${risk.high} high-risk client${risk.high === 1 ? '' : 's'}`} />
        <Stat label="Client retention" value={d.stats.retention == null ? '—' : `${d.stats.retention}%`} hint="Clients still with you" />
      </div>
      <Card title="Engagement, last 12 weeks">
        <LineChart width={1100} height={260} labels={eng12.map((_, i) => `W${i + 1}`)} current={eng12} />
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Estimated monthly revenue (12 months)">
          <BarChart values={rev.map((r) => r.value)} labels={rev.map((r) => r.label)} height={160} showLabels />
          <p className="mt-2 text-xs text-slate-500">Based on current clients&apos; fees and start dates.</p>
        </Card>
        <Card title="Clients checking in per week">
          <BarChart values={completion} labels={completion.map((_, i) => `W${i + 1}`)} height={160} showLabels />
          <p className="mt-2 text-xs text-slate-500">Out of {d.active.length} active clients this week.</p>
        </Card>
      </div>
      <Card title="Client risk">
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
          {(['high', 'medium', 'low'] as const).map((k) => d.active.length ? (
            <div key={k} style={{ width: `${(risk[k] / d.active.length) * 100}%` }} className={k === 'high' ? 'bg-red-500' : k === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'} />
          ) : null)}
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-sm text-slate-600">
          <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />At risk: {risk.high}</span>
          <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Watch: {risk.medium}</span>
          <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />On track: {risk.low}</span>
        </div>
      </Card>
    </div>
  );
}
