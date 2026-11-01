import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, RiskBadge } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { markReviewed, runAiAnalysis, sendReply } from '../actions';
import { longDate, shortDate } from '@/lib/format';
import type { Checkin, Client } from '@/lib/types';

const METRICS: { key: keyof Checkin; label: string; unit?: string; goodWhen?: 'up' | 'down' }[] = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'training_adherence', label: 'Training adherence', unit: '%', goodWhen: 'up' },
  { key: 'nutrition_adherence', label: 'Nutrition adherence', unit: '%', goodWhen: 'up' },
  { key: 'sleep_hours', label: 'Sleep', unit: 'h', goodWhen: 'up' },
  { key: 'sleep_quality', label: 'Sleep quality', unit: '/10', goodWhen: 'up' },
  { key: 'energy', label: 'Energy', unit: '/10', goodWhen: 'up' },
  { key: 'stress', label: 'Stress', unit: '/10', goodWhen: 'down' },
  { key: 'hunger', label: 'Hunger', unit: '/10' },
  { key: 'avg_steps', label: 'Avg steps' },
];

export default async function CheckinReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { data: ci } = await supabase.from('checkins').select('*').eq('id', id).single();
  if (!ci) notFound();
  const c = ci as Checkin;
  const [{ data: client }, { data: prevRows }, { data: photos }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', c.client_id).single(),
    supabase.from('checkins').select('*').eq('client_id', c.client_id).lt('submitted_at', c.submitted_at).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('progress_photos').select('storage_path, pose').eq('checkin_id', id),
  ]);
  const cl = client as Client;
  const prev = (prevRows?.[0] ?? null) as Checkin | null;
  const signed = photos?.length ? (await supabase.storage.from('progress-photos').createSignedUrls(photos.map((p) => p.storage_path), 600)).data : [];
  const ai = c.ai_analysis;
  const labels = Object.fromEntries((coach.checkin_questions ?? []).map((q) => [q.id, q.label]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/coach/checkins" className="text-sm text-slate-500 hover:underline">← Check-ins</Link>
          <h1 className="mt-1"><Link href={`/coach/clients/${cl.id}`} className="hover:underline">{cl.full_name}</Link></h1>
          <p className="text-sm text-slate-500">Submitted {longDate(c.submitted_at)}{prev ? ` · compared with ${shortDate(prev.submitted_at)}` : ' · first check-in'}</p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={cl.risk_level} score={cl.risk_score} />
          <Badge tone={c.status === 'reviewed' ? 'green' : 'amber'}>{c.status}</Badge>
        </div>
      </div>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="This week vs last">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {METRICS.map((m) => {
                  const now = c[m.key] as number | null, before = prev ? (prev[m.key] as number | null) : null;
                  if (now == null && before == null) return null;
                  const delta = now != null && before != null ? Number((now - before).toFixed(1)) : null;
                  const good = delta == null || delta === 0 || !m.goodWhen ? null : (delta > 0) === (m.goodWhen === 'up');
                  return (
                    <tr key={m.key}>
                      <td className="py-2 text-slate-500">{m.label}</td>
                      <td className="py-2 text-right font-medium">{now ?? '—'}{now != null ? m.unit ?? '' : ''}</td>
                      <td className={`py-2 pl-3 text-right text-xs ${good == null ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-600'}`}>
                        {delta != null && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : delta === 0 ? '±0' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card title="Client's answers">
            <dl className="space-y-3 text-sm">
              <QA q="Biggest win" a={c.wins} /><QA q="Biggest struggle" a={c.struggles} /><QA q="Questions for coach" a={c.questions} />
              {Object.entries(c.custom_answers ?? {}).map(([k, v]) => <QA key={k} q={labels[k] ?? k} a={v} />)}
            </dl>
          </Card>
          {signed?.length ? (
            <Card title="Progress photos">
              <div className="grid grid-cols-3 gap-2">{signed.map((s, i) => s.signedUrl && <img key={i} src={s.signedUrl} alt={photos![i].pose ?? ''} className="aspect-[3/4] w-full rounded-lg object-cover" />)}</div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="AI coaching assistant" action={
            <form action={runAiAnalysis}><input type="hidden" name="checkin_id" value={id} />
              <SubmitButton className="btn-secondary" pendingText="Analysing…">{ai ? 'Re-run' : 'Analyse check-in'}</SubmitButton></form>
          }>
            {!ai ? (
              <p className="text-sm text-slate-500">Get a summary, week-on-week changes, concerns to look at and a drafted reply in your voice. Nothing is sent without your approval.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-2"><span className="text-slate-500">Engagement:</span>
                  <Badge tone={ai.engagement === 'declining' ? 'red' : ai.engagement === 'improving' ? 'green' : 'slate'}>{ai.engagement}</Badge></div>
                <p>{ai.summary}</p>
                <List title="Changes" items={ai.changes} />
                <List title="Concerns" items={ai.concerns} tone="red" />
                <List title="Worth asking / checking" items={ai.investigate} />
                <p className="text-xs text-slate-400">AI-generated from this client&apos;s data. Check before acting. Not medical advice.</p>
              </div>
            )}
          </Card>

          <Card title={c.status === 'reviewed' ? 'Your reply' : 'Reply to client'}>
            {c.status === 'reviewed' && c.coach_reply ? (
              <p className="whitespace-pre-wrap text-sm">{c.coach_reply}</p>
            ) : (
              <form action={sendReply} className="space-y-3">
                <input type="hidden" name="checkin_id" value={id} />
                <textarea name="reply" rows={10} className="input" defaultValue={ai?.draft_reply ?? ''} placeholder="Write your feedback…" />
                {ai && <p className="text-xs text-slate-500">Draft written by AI. Edit it so it sounds like you, then approve.</p>}
                <div className="flex gap-2">
                  <SubmitButton pendingText="Sending…">Approve & send</SubmitButton>
                  <button formAction={markReviewed} className="btn-secondary">Mark reviewed without reply</button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function QA({ q, a }: { q: string; a: string | null | undefined }) {
  return <div><dt className="text-slate-500">{q}</dt><dd className="whitespace-pre-wrap">{a || '—'}</dd></div>;
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: 'red' }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${tone === 'red' ? 'text-red-600' : 'text-slate-500'}`}>{title}</div>
      <ul className="list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}
