import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { relativeDay, type CheckinStatus } from '@/lib/coaching';
import { longDate, shortDate } from '@/lib/format';
import type { Checkin, Client } from '@/lib/types';

export async function CheckinsTab({ supabase, client, status }: { supabase: SupabaseClient; client: Client; status?: CheckinStatus }) {
  const { data } = await supabase.from('checkins').select('*').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(104);
  const rows = (data ?? []) as Checkin[];
  const pct = (v: number | null) => (v != null ? `${v}%` : '—');
  return (
    <div className="space-y-4">
      {status && status.state !== 'submitted' && (
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${status.state === 'missed' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-surface'}`}>
          <Icon name={status.state === 'missed' ? 'missed' : 'clock'} className={`h-4 w-4 ${status.state === 'missed' ? 'text-red-400' : 'text-slate-500'}`} />
          <span className="flex-1">{status.state === 'missed' ? `${status.missedCount > 1 ? `Missed ${status.missedCount} check-ins in a row` : 'Missed this week’s check-in'}${status.lastAt ? ` · last one ${longDate(status.lastAt)}` : ''}` : status.state === 'due' ? `This week’s check-in is due ${relativeDay(status.due)}` : 'First check-in not due yet'}</span>
          {status.state === 'missed' && <Link href={`/coach/clients/${client.id}?tab=messages&draft=1`} className="text-[13px] link">Nudge</Link>}
        </div>
      )}
      <Card flush>
        {!rows.length ? <div className="p-4 md:p-5"><EmptyState icon="checkins" title="No check-ins yet">Clients are asked to check in every week from their app.</EmptyState></div> : (
          <>
            <ul className="divide-y divide-slate-200 md:hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/coach/checkins/${r.id}`} className="row-link flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-medium">{longDate(r.submitted_at)}{r.status === 'submitted' && <Badge tone="amber">Review</Badge>}</div>
                      <div className="num mt-0.5 text-xs text-slate-500">{r.weight_kg != null ? `${r.weight_kg}kg · ` : ''}Training {pct(r.training_adherence)} · Nutrition {pct(r.nutrition_adherence)}{r.energy != null ? ` · Energy ${r.energy}/10` : ''}</div>
                    </div>
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs text-slate-500"><tr>
                  {['Date', 'Weight', 'Waist', 'Training', 'Nutrition', 'Energy', 'Sleep', 'Stress', ''].map((h, i) => <th key={i} className={`py-2.5 font-medium ${i === 0 ? 'px-5' : i === 8 ? 'px-5 text-right' : 'px-3 text-right'}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-200">{rows.map((r) => (
                  <tr key={r.id} className="row-link">
                    <td className="px-5 py-3">{shortDate(r.submitted_at)}</td>
                    <td className="num px-3 py-3 text-right">{r.weight_kg ?? '—'}</td>
                    <td className="num px-3 py-3 text-right">{r.waist_cm ?? '—'}</td>
                    <td className="num px-3 py-3 text-right">{pct(r.training_adherence)}</td>
                    <td className="num px-3 py-3 text-right">{pct(r.nutrition_adherence)}</td>
                    <td className="num px-3 py-3 text-right">{r.energy ?? '—'}</td>
                    <td className="num px-3 py-3 text-right">{r.sleep_hours != null ? `${r.sleep_hours}h` : '—'}</td>
                    <td className="num px-3 py-3 text-right">{r.stress ?? '—'}</td>
                    <td className="px-5 py-3 text-right"><Link href={`/coach/checkins/${r.id}`} className="link">{r.status === 'submitted' ? 'Review' : 'View'}</Link></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
