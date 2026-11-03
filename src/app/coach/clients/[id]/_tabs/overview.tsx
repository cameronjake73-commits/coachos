import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Badge, Card, CardLink, EmptyState, KeyValue, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { generateClientSummary } from '../../actions';
import { aiEnabled } from '@/lib/ai';
import { progressFacts, firstLast } from '@/lib/progress';
import { relativeDay, type CheckinStatus } from '@/lib/coaching';
import { longDate, shortDate, timeAgo } from '@/lib/format';
import type { Checkin, Client, Coach } from '@/lib/types';

const ONBOARDING_LABELS: [string, string][] = [
  ['main_goal', 'Main goal'], ['why_now', 'Why now'], ['age', 'Age'], ['height_cm', 'Height (cm)'], ['starting_weight_kg', 'Starting weight (kg)'],
  ['training_experience', 'Training experience'], ['training_days_per_week', 'Days per week'], ['equipment', 'Where they train'],
  ['injuries', 'Injuries / medical'], ['diet', 'Diet'], ['lifestyle', 'Lifestyle'],
];
const DAY = 86_400_000;
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };

export async function OverviewTab({ supabase, coach, client, status }: { supabase: SupabaseClient; coach: Coach; client: Client; status?: CheckinStatus }) {
  const since = new Date(Date.now() - 56 * DAY).toISOString();
  const [{ data: cis }, { data: logs }, { data: progs }] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', client.id).order('submitted_at', { ascending: false }).limit(16),
    supabase.from('workout_logs').select('completed_at').eq('client_id', client.id).gte('completed_at', since),
    supabase.from('programs').select('id, name, workouts(id)').eq('client_id', client.id).eq('is_active', true).limit(1),
  ]);
  const rows = ((cis ?? []) as Checkin[]).slice().reverse();
  const latest = rows[rows.length - 1];
  const planned = Math.min(7, progs?.[0]?.workouts?.length ?? 0);
  const perWeek = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - (7 - i) * 7 * DAY, start = end - 7 * DAY;
    return (logs ?? []).filter((l) => { const t = new Date(l.completed_at).getTime(); return t > start && t <= end; }).length;
  });
  const last14 = perWeek.slice(-2).reduce((a, b) => a + b, 0);
  const weight = firstLast(rows, 'weight_kg');
  const recent4 = rows.slice(-4);
  const facts = progressFacts(client, rows, perWeek, planned);
  const ai = aiEnabled();
  const summary = client.ai_summary;
  const toTarget = weight && client.target_weight_kg ? Math.round((weight.last - Number(client.target_weight_kg)) * 10) / 10 : null;
  const targetProgress = weight && client.target_weight_kg && weight.first !== Number(client.target_weight_kg)
    ? Math.round(((weight.first - weight.last) / (weight.first - Number(client.target_weight_kg))) * 100) : null;

  const checkinLabel = !status ? '—' : status.state === 'submitted' ? 'Checked in' : status.state === 'missed' ? (status.missedCount > 1 ? `Missed ${status.missedCount}` : 'Missed') : status.state === 'due' ? `Due ${relativeDay(status.due)}` : 'Not due yet';

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card">
            <div className="text-[13px] text-slate-500">Weight</div>
            <div className="num mt-1.5 text-xl font-semibold">{weight ? `${weight.last}kg` : '—'}</div>
            <div className="mt-1 text-xs text-slate-500">{weight && weight.count > 1 ? <span className={weight.change < 0 ? 'text-emerald-700' : weight.change > 0 ? 'text-amber-700' : ''}>{weight.change > 0 ? '+' : ''}{weight.change}kg since start</span> : 'No weigh-ins yet'}</div>
          </div>
          <div className="card">
            <div className="text-[13px] text-slate-500">This week</div>
            <div className={`mt-1.5 text-xl font-semibold ${status?.state === 'missed' ? 'text-red-700' : status?.state === 'submitted' ? 'text-emerald-700' : ''}`}>{checkinLabel}</div>
            <div className="mt-1 text-xs text-slate-500">{latest ? `Last ${timeAgo(latest.submitted_at)}` : 'No check-ins yet'}</div>
          </div>
          <div className="card">
            <div className="text-[13px] text-slate-500">Workouts (14 days)</div>
            <div className="num mt-1.5 text-xl font-semibold">{last14}{planned ? <span className="text-sm text-slate-500"> / {planned * 2}</span> : ''}</div>
            <div className="mt-2">{planned ? <ProgressBar value={(last14 / (planned * 2)) * 100} tone={last14 / (planned * 2) >= 0.75 ? 'green' : last14 / (planned * 2) >= 0.5 ? 'amber' : 'red'} /> : <span className="text-xs text-slate-500">No programme</span>}</div>
          </div>
          <div className="card">
            <div className="text-[13px] text-slate-500">Adherence (4 wks)</div>
            <div className="num mt-1.5 text-xl font-semibold">{avg(recent4.map((r) => r.training_adherence)) ?? '—'}{recent4.length ? '%' : ''}<span className="text-sm text-slate-500"> / {avg(recent4.map((r) => r.nutrition_adherence)) ?? '—'}{recent4.length ? '%' : ''}</span></div>
            <div className="mt-1 text-xs text-slate-500">Training / nutrition</div>
          </div>
        </div>

        <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-[#181338] to-surface p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2"><Icon name="sparkle" className="h-5 w-5 text-brand-300" />Progress summary</h2>
            {ai ? (
              <form action={generateClientSummary}><input type="hidden" name="client_id" value={client.id} />
                <SubmitButton className="btn-secondary btn-sm" pendingText="Summarising…">{summary ? 'Refresh' : 'Summarise with AI'}</SubmitButton></form>
            ) : <Link href="/coach/settings#ai" className="text-xs link">Connect AI</Link>}
          </div>
          {summary ? (
            <div className="mt-3 space-y-4">
              <p className="text-sm text-slate-800">{summary.summary}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div><div className="eyebrow mb-1.5">What the data shows</div><ul className="space-y-1.5 text-[13px] text-slate-700">{summary.observations.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{o}</li>)}</ul></div>
                <div><div className="eyebrow mb-1.5 text-brand-300">Ideas to consider</div><ul className="space-y-1.5 text-[13px] text-slate-700">{summary.suggestions.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />{o}</li>)}</ul></div>
              </div>
              <p className="text-2xs text-slate-500">AI summary of this client&apos;s data, {timeAgo(summary.generated_at)}. Check before acting. Not medical advice.</p>
            </div>
          ) : (
            <div className="mt-3">
              {facts.length > 1 ? (
                <>
                  <div className="eyebrow mb-1.5">What the data shows</div>
                  <ul className="space-y-1.5 text-[13px] text-slate-700">{facts.map((f) => <li key={f} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{f}</li>)}</ul>
                </>
              ) : <p className="text-[13px] text-slate-500">A summary appears once {client.full_name.split(' ')[0]} has submitted a couple of check-ins.</p>}
            </div>
          )}
        </section>

        <Card title="Latest check-in" action={latest && <CardLink href={`/coach/checkins/${latest.id}`}>{latest.status === 'submitted' ? 'Review' : 'Open'}</CardLink>}>
          {!latest ? <EmptyState compact icon="checkins" title="No check-ins yet">They&apos;ll be asked to check in every week from their app.</EmptyState> : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
                {longDate(latest.submitted_at)}
                <Badge tone={latest.status === 'submitted' ? 'amber' : 'green'}>{latest.status === 'submitted' ? 'Needs review' : 'Reviewed'}</Badge>
                {latest.ai_analysis?.engagement && <Badge tone={latest.ai_analysis.engagement === 'declining' ? 'red' : latest.ai_analysis.engagement === 'improving' ? 'green' : 'slate'}>Engagement {latest.ai_analysis.engagement}</Badge>}
              </div>
              <KeyValue cols={3} items={[
                ['Weight', latest.weight_kg != null ? `${latest.weight_kg}kg` : '—'],
                ['Training', latest.training_adherence != null ? `${latest.training_adherence}%` : '—'],
                ['Nutrition', latest.nutrition_adherence != null ? `${latest.nutrition_adherence}%` : '—'],
                ['Energy', latest.energy != null ? `${latest.energy}/10` : '—'],
                ['Sleep', latest.sleep_hours != null ? `${latest.sleep_hours}h` : '—'],
                ['Stress', latest.stress != null ? `${latest.stress}/10` : '—'],
              ]} />
              {(latest.wins || latest.struggles) && (
                <div className="grid gap-3 border-t border-slate-200 pt-3 text-sm sm:grid-cols-2">
                  {latest.wins && <div><div className="text-xs text-slate-500">Win</div><p className="mt-0.5 line-clamp-3">{latest.wins}</p></div>}
                  {latest.struggles && <div><div className="text-xs text-slate-500">Struggle</div><p className="mt-0.5 line-clamp-3">{latest.struggles}</p></div>}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Goal">
          <p className="text-sm text-slate-800">{client.goal || 'No goal set yet.'}</p>
          {(client.target_weight_kg || client.goal_deadline) && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-[13px]">
              {client.target_weight_kg && <div className="flex justify-between"><span className="text-slate-500">Target weight</span><span className="num">{client.target_weight_kg}kg{toTarget != null ? ` · ${Math.abs(toTarget)}kg ${toTarget > 0 ? 'to go' : toTarget < 0 ? 'past target' : 'reached'}` : ''}</span></div>}
              {targetProgress != null && targetProgress >= 0 && <ProgressBar value={targetProgress} tone="green" />}
              {client.goal_deadline && <div className="flex justify-between"><span className="text-slate-500">Goal date</span><span>{longDate(client.goal_deadline)}</span></div>}
            </div>
          )}
          <Link href={`/coach/clients/${client.id}?tab=details`} className="mt-3 inline-block text-[13px] link">Edit goal</Link>
        </Card>

        {client.status === 'active' && (
          <Card title="Risk signals" description={client.risk_updated_at ? `Updated ${shortDate(client.risk_updated_at)}` : undefined}>
            {client.risk_reasons.length ? (
              <ul className="space-y-2 text-[13px]">{client.risk_reasons.map((r) => <li key={r} className="flex gap-2 text-slate-700"><Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />{r}</li>)}</ul>
            ) : <p className="flex items-center gap-2 text-[13px] text-emerald-700"><Icon name="checkCircle" className="h-4 w-4" />No warning signs</p>}
          </Card>
        )}

        <Card title="Onboarding answers" description={client.health_consent_at ? `Health data consent given ${longDate(client.health_consent_at)}` : 'Not completed yet'}>
          {Object.keys(client.onboarding || {}).length ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-[13px] link">Show answers<span className="group-open:hidden"> ({ONBOARDING_LABELS.filter(([k]) => client.onboarding[k]).length})</span></summary>
              <dl className="mt-3 space-y-2.5 text-[13px]">{ONBOARDING_LABELS.filter(([k]) => client.onboarding[k]).map(([k, label]) => (
                <div key={k}><dt className="text-xs text-slate-500">{label}</dt><dd className="whitespace-pre-wrap text-slate-800">{String(client.onboarding[k])}</dd></div>
              ))}</dl>
            </details>
          ) : <p className="text-[13px] text-slate-500">Answers appear here once {client.full_name.split(' ')[0]} joins.</p>}
        </Card>

        {client.notes && <Card title="Private notes"><p className="whitespace-pre-wrap text-[13px] text-slate-700">{client.notes}</p></Card>}
      </div>
    </div>
  );
}
