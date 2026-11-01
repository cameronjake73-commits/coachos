import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, Empty, RiskBadge } from '@/components/ui';
import { shortDate } from '@/lib/format';
import type { RiskLevel } from '@/lib/types';

export default async function CheckinsQueue({ searchParams }: { searchParams: Promise<{ done?: string; view?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const status = sp.view === 'reviewed' ? 'reviewed' : 'submitted';
  const { data } = await supabase.from('checkins')
    .select('id, submitted_at, training_adherence, nutrition_adherence, weight_kg, ai_analysis, clients(id, full_name, risk_level)')
    .eq('coach_id', coach.id).eq('status', status).order('submitted_at', { ascending: status === 'submitted' }).limit(100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1>Check-ins</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/coach/checkins" className={status === 'submitted' ? 'font-semibold' : 'link'}>To review</Link>
          <span className="text-slate-300">|</span>
          <Link href="/coach/checkins?view=reviewed" className={status === 'reviewed' ? 'font-semibold' : 'link'}>Reviewed</Link>
        </div>
      </div>
      {sp.done && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">All check-ins reviewed. Nice work.</p>}
      <Card className="p-0">
        {!data?.length ? <div className="p-5"><Empty>{status === 'submitted' ? 'Nothing waiting for review.' : 'No reviewed check-ins yet.'}</Empty></div> : (
          <ul className="divide-y divide-slate-100">
            {data.map((c) => {
              const cl = c.clients as unknown as { id: string; full_name: string; risk_level: RiskLevel };
              return (
                <li key={c.id}>
                  <Link href={`/coach/checkins/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-slate-50">
                    <div>
                      <div className="font-medium">{cl?.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {c.weight_kg ? `${c.weight_kg}kg · ` : ''}Training {c.training_adherence ?? '—'}% · Nutrition {c.nutrition_adherence ?? '—'}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.ai_analysis ? <Badge tone="green">AI summary ready</Badge> : null}
                      {cl?.risk_level && cl.risk_level !== 'low' ? <RiskBadge level={cl.risk_level} /> : null}
                      <span className="text-xs text-slate-500">{shortDate(c.submitted_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
