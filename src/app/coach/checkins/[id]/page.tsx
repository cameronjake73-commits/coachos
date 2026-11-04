import { PendingButton } from '@/components/form-bits';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, Delta, EmptyState, ProgressBar, RiskBadge } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { markReviewed, runAiAnalysis, sendReply } from '../actions';
import { aiEnabled } from '@/lib/ai';
import { trainingPerformance } from '@/lib/performance';
import { longDate, shortDate } from '@/lib/format';
import { MEASUREMENTS, type Checkin, type Client } from '@/lib/types';

const BODY = [{ key: 'weight_kg', label: 'Weight', unit: 'kg' }, ...MEASUREMENTS] as const;
const WELL: { key: keyof Checkin; label: string; unit: string; goodWhen?: 'up' | 'down' }[] = [
  { key: 'sleep_hours', label: 'Sleep', unit: 'h', goodWhen: 'up' },
  { key: 'sleep_quality', label: 'Sleep quality', unit: '/10', goodWhen: 'up' },
  { key: 'energy', label: 'Energy', unit: '/10', goodWhen: 'up' },
  { key: 'stress', label: 'Stress', unit: '/10', goodWhen: 'down' },
  { key: 'hunger', label: 'Hunger', unit: '/10' },
  { key: 'avg_steps', label: 'Daily steps', unit: '', goodWhen: 'up' },
];

const num = (r: Checkin | null | undefined, k: keyof Checkin) => (r && r[k] != null ? Number(r[k]) : null);
const diff = (a: number | null, b: number | null) => (a != null && b != null ? a - b : null);

export default async function CheckinReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { data: ci } = await supabase.from('checkins').select('*').eq('id', id).maybeSingle();
  if (!ci) notFound();
  const c = ci as Checkin;
  const [{ data: client }, { data: history }, { data: ownPhotos }, { data: olderPhotos }, { data: queue }, perf, { data: prog }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', c.client_id).single(),
    supabase.from('checkins').select('*').eq('client_id', c.client_id).lt('submitted_at', c.submitted_at).order('submitted_at', { ascending: false }).limit(60),
    supabase.from('progress_photos').select('id, storage_path, pose, taken_at, checkin_id').eq('checkin_id', id),
    supabase.from('progress_photos').select('id, storage_path, pose, taken_at, checkin_id').eq('client_id', c.client_id).lt('taken_at', c.submitted_at).order('taken_at', { ascending: false }).limit(24),
    supabase.from('checkins').select('id').eq('coach_id', coach.id).eq('status', 'submitted').order('submitted_at').limit(200),
    trainingPerformance(supabase, c.client_id, c.submitted_at),
    supabase.from('programs').select('workouts(id)').eq('client_id', c.client_id).eq('is_active', true).limit(1),
  ]);
  const cl = client as Client;
  const prev = (history ?? []) as Checkin[];
  const last = prev[0] ?? null;
  const fourAgo = prev.find((p) => new Date(c.submitted_at).getTime() - new Date(p.submitted_at).getTime() >= 26 * 864e5) ?? null;
  const first = prev.length ? prev[prev.length - 1] : null;
  const planned = Math.min(7, prog?.[0]?.workouts?.length ?? 0);
  const ai = c.ai_analysis;
  const aiOn = aiEnabled();
  const questions = Object.fromEntries((coach.checkin_questions ?? []).map((q) => [q.id, q]));
  const lastReply = prev.find((p) => p.coach_reply);

  const thisPhotos = ownPhotos ?? [];
  const prevPhotos = (olderPhotos ?? []).filter((p) => p.checkin_id !== id);
  const pairs = thisPhotos.map((p) => ({ now: p, before: prevPhotos.find((q) => q.pose === p.pose) }));
  const toSign = [...thisPhotos, ...pairs.map((p) => p.before).filter(Boolean)] as { id: string; storage_path: string }[];
  const signed = toSign.length ? (await supabase.storage.from('progress-photos').createSignedUrls(toSign.map((p) => p.storage_path), 900)).data ?? [] : [];
  const url = new Map<string, string>(); toSign.forEach((p, i) => { if (signed[i]?.signedUrl) url.set(p.id, signed[i].signedUrl!); });

  const q = (queue ?? []).map((r) => r.id as string);
  const pos = q.indexOf(id);
  const nextId = pos >= 0 ? q[pos + 1] : q[0];
  const bodyRows = BODY.filter((m) => num(c, m.key as keyof Checkin) != null || num(last, m.key as keyof Checkin) != null);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/coach/checkins" className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] text-slate-500 hover:text-slate-800"><Icon name="chevronLeft" className="h-4 w-4" />Check-ins</Link>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {pos >= 0 && <span className="num">{pos + 1} of {q.length} to review</span>}
          {nextId && nextId !== id && <Link href={`/coach/checkins/${nextId}`} className="btn-ghost btn-sm">Skip<Icon name="chevronRight" className="h-4 w-4" /></Link>}
        </div>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={cl.full_name} size={46} />
          <div>
            <h1><Link href={`/coach/clients/${cl.id}`} className="hover:underline">{cl.full_name}</Link></h1>
            <p className="text-[13px] text-slate-500">Submitted {longDate(c.submitted_at)}{last ? ` · compared with ${shortDate(last.submitted_at)}` : ' · first check-in'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cl.status === 'active' && <RiskBadge level={cl.risk_level} />}
          <Badge tone={c.status === 'reviewed' ? 'green' : 'amber'}>{c.status === 'reviewed' ? 'Reviewed' : 'Needs review'}</Badge>
          <a href="#reply" className="btn-primary btn-sm lg:hidden">Reply</a>
        </div>
      </header>
      {sp.error && <Alert tone="red">{sp.error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card title="Body" description={first ? `Change vs last week${fourAgo ? ', 4 weeks ago' : ''} and since starting (${shortDate(first.submitted_at)})` : undefined} flush>
            {!bodyRows.length ? <div className="px-4 pb-4 md:px-5"><p className="text-[13px] text-slate-500">No weight or measurements this week.</p></div> : (
              <table className="w-full border-t border-slate-200 text-sm">
                <thead className="text-left text-2xs uppercase tracking-wide text-slate-500"><tr>
                  <th className="px-4 py-2 font-medium md:px-5"></th><th className="px-2 py-2 text-right font-medium">Now</th><th className="px-2 py-2 text-right font-medium">vs last</th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">vs 4 wks</th><th className="px-4 py-2 text-right font-medium md:px-5">vs start</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {bodyRows.map((m) => {
                    const k = m.key as keyof Checkin, now = num(c, k);
                    const good = m.key === 'weight_kg' ? (cl.target_weight_kg && first?.weight_kg ? (Number(cl.target_weight_kg) > Number(first.weight_kg) ? 'up' : 'down') : undefined) : m.key === 'waist_cm' || m.key === 'body_fat_pct' ? 'down' : undefined;
                    return (
                      <tr key={m.key}>
                        <td className="px-4 py-2.5 text-slate-600 md:px-5">{m.label}</td>
                        <td className="num px-2 py-2.5 text-right font-medium">{now ?? '—'}{now != null ? m.unit : ''}</td>
                        <td className="px-2 py-2.5 text-right text-[13px]"><Delta value={diff(now, num(last, k))} unit={m.unit} goodWhen={good} /></td>
                        <td className="hidden px-2 py-2.5 text-right text-[13px] sm:table-cell"><Delta value={diff(now, num(fourAgo, k))} unit={m.unit} goodWhen={good} /></td>
                        <td className="px-4 py-2.5 text-right text-[13px] md:px-5"><Delta value={diff(now, num(first, k))} unit={m.unit} goodWhen={good} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Adherence and wellbeing">
            <div className="grid gap-4 sm:grid-cols-2">
              {(['training_adherence', 'nutrition_adherence'] as const).map((k) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between text-[13px]"><span className="text-slate-600">{k === 'training_adherence' ? 'Training' : 'Nutrition'}</span>
                    <span><span className="num font-semibold text-slate-900">{c[k] ?? '—'}{c[k] != null ? '%' : ''}</span> <span className="ml-1 text-xs"><Delta value={diff(num(c, k), num(last, k))} unit="%" goodWhen="up" digits={0} /></span></span></div>
                  <div className="mt-1.5"><ProgressBar value={c[k] ?? 0} tone={(c[k] ?? 0) >= 80 ? 'green' : (c[k] ?? 0) >= 50 ? 'amber' : 'red'} /></div>
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
              {WELL.filter((w) => c[w.key] != null).map((w) => (
                <div key={w.key}>
                  <dt className="text-xs text-slate-500">{w.label}</dt>
                  <dd className="mt-0.5 flex items-baseline gap-2"><span className="num font-medium">{w.key === 'avg_steps' ? Number(c[w.key]).toLocaleString('en-GB') : String(c[w.key])}{w.unit}</span>
                    <span className="text-xs"><Delta value={diff(num(c, w.key), num(last, w.key))} goodWhen={w.goodWhen} digits={w.key === 'avg_steps' ? 0 : 1} /></span></dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Training this week" description="Logged in the 7 days before this check-in">
            <div className="flex items-baseline gap-2"><span className="num text-2xl font-semibold">{perf.sessions}</span><span className="text-[13px] text-slate-500">{planned ? `of ${planned} planned sessions` : 'sessions (no programme assigned)'}{perf.avgRpe ? ` · avg RPE ${perf.avgRpe}` : ''}</span></div>
            {planned > 0 && <div className="mt-2"><ProgressBar value={(perf.sessions / planned) * 100} tone={perf.sessions >= planned ? 'green' : perf.sessions >= planned / 2 ? 'amber' : 'red'} /></div>}
            {perf.exercises.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
                {perf.exercises.slice(0, 6).map((x) => (
                  <li key={x.exercise} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-800">{x.exercise}</span>
                    <span className="num text-slate-600">{x.thisWeek!.kg}kg × {x.thisWeek!.reps}</span>
                    <span className="w-14 text-right">{x.change != null ? <Delta value={x.change} unit="%" goodWhen="up" /> : <span className="text-xs text-slate-500">new</span>}</span>
                  </li>
                ))}
              </ul>
            )}
            {perf.exercises.length > 0 && <p className="mt-2 text-2xs text-slate-500">Best set vs the 3 weeks before, compared by estimated 1-rep max.</p>}
          </Card>

          <Card title="In their words">
            <dl className="space-y-4 text-sm">
              {[['Biggest win', c.wins], ['Biggest struggle', c.struggles], ['Questions for you', c.questions]].map(([label, val]) => (
                <div key={label as string}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap text-slate-900">{val || <span className="text-slate-400">No answer</span>}</dd></div>
              ))}
              {Object.entries(c.custom_answers ?? {}).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-slate-500">{questions[k]?.label ?? k}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-slate-900">{questions[k]?.type === 'scale' ? `${v}/10` : questions[k]?.type === 'yesno' ? (v === 'yes' ? 'Yes' : 'No') : v}</dd></div>
              ))}
            </dl>
          </Card>

          {pairs.length > 0 && (
            <Card title="Progress photos" description="This week next to their previous photo for each pose">
              <div className="grid gap-4 sm:grid-cols-2">
                {pairs.map(({ now, before }) => (
                  <div key={now.id}>
                    <div className="mb-1.5 text-xs font-medium capitalize text-slate-600">{now.pose}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[before, now].map((p, i) => p && url.get(p.id) ? (
                        <figure key={p.id} className="relative overflow-hidden rounded-lg bg-slate-100">
                          <a href={url.get(p.id)} target="_blank" rel="noreferrer"><img src={url.get(p.id)} alt={`${now.pose} ${i ? 'this week' : 'before'}`} className="aspect-[3/4] w-full object-cover" /></a>
                          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-2xs text-white">{i ? 'This week' : shortDate(p.taken_at)}</figcaption>
                        </figure>
                      ) : <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-slate-300 text-2xs text-slate-500">{i ? '' : 'No earlier photo'}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-[#181338] to-surface p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2"><Icon name="sparkle" className="h-5 w-5 text-brand-300" />AI assistant</h2>
                {aiOn && <form action={runAiAnalysis}><input type="hidden" name="checkin_id" value={id} /><SubmitButton className="btn-secondary btn-sm" pendingText="Analysing…">{ai ? 'Re-run' : 'Analyse'}</SubmitButton></form>}
              </div>
              {!ai && !aiOn ? (
                <p className="mt-2 text-[13px] text-slate-600">AI isn&apos;t connected yet, so there&apos;s no automatic summary or drafted reply. Everything else on this page works without it. <Link href="/coach/settings#ai" className="link">How to connect AI</Link></p>
              ) : !ai ? (
                <p className="mt-2 text-[13px] text-slate-600">Get a summary of what changed, things to look at and a reply drafted in your voice. Nothing is sent without your approval.</p>
              ) : (
                <div className="mt-3 space-y-4 text-[13px]">
                  <div className="flex items-center gap-2"><span className="text-slate-500">Engagement</span><Badge tone={ai.engagement === 'declining' ? 'red' : ai.engagement === 'improving' ? 'green' : 'slate'}>{ai.engagement}</Badge></div>
                  <p className="text-sm text-slate-900">{ai.summary}</p>
                  <AiList title="What the data shows" items={ai.observations ?? ai.changes} dot="bg-slate-400" />
                  <AiList title="Needs your attention" items={ai.concerns} dot="bg-red-500" titleClass="text-red-700" />
                  <AiList title="Ideas to consider" items={ai.suggestions ?? []} dot="bg-brand-400" titleClass="text-brand-300" />
                  <AiList title="Worth asking" items={ai.investigate} dot="bg-sky-400" />
                  <p className="text-2xs text-slate-500">Generated from this client&apos;s data. Suggestions only. You make the coaching decisions. Not medical advice.</p>
                </div>
              )}
            </section>

            <Card title={c.status === 'reviewed' ? 'Your reply' : 'Reply to client'} className="scroll-mt-20" >
              <span id="reply" className="relative -top-24 block" aria-hidden />
              {c.status === 'reviewed' ? (
                c.coach_reply ? <><p className="whitespace-pre-wrap text-sm">{c.coach_reply}</p><p className="mt-2 text-xs text-slate-500">Sent {c.replied_at ? longDate(c.replied_at) : ''}</p></> : <EmptyState compact icon="check" title="Marked reviewed without a reply" />
              ) : (
                <form action={sendReply} className="space-y-3">
                  <input type="hidden" name="checkin_id" value={id} />
                  <label className="sr-only" htmlFor="reply-text">Reply</label>
                  <textarea id="reply-text" name="reply" rows={11} maxLength={5000} className="input" defaultValue={ai?.draft_reply ?? ''} placeholder={`Write your feedback for ${cl.full_name.split(' ')[0]}…`} />
                  {ai?.draft_reply && <p className="text-xs text-slate-500">Drafted by AI from their data. Edit it so it sounds like you, then send.</p>}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <SubmitButton className="btn-primary flex-1" pendingText="Sending…"><Icon name="send" className="h-4 w-4" />Send reply</SubmitButton>
                    <PendingButton formAction={markReviewed} className="btn-secondary" pendingLabel="Saving…">Mark reviewed</PendingButton>
                  </div>
                  <p className="text-2xs text-slate-500">Sent to their app{cl.email_reminders ? ' and by email' : ''}. Then the next check-in opens.</p>
                </form>
              )}
              {lastReply && c.status !== 'reviewed' && (
                <details className="mt-4 border-t border-slate-200 pt-3 text-[13px]">
                  <summary className="cursor-pointer text-slate-500">Your previous reply ({shortDate(lastReply.replied_at ?? lastReply.submitted_at)})</summary>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">{lastReply.coach_reply}</p>
                </details>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiList({ title, items, dot, titleClass = 'text-slate-500' }: { title: string; items: string[]; dot: string; titleClass?: string }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={`eyebrow mb-1.5 ${titleClass}`}>{title}</div>
      <ul className="space-y-1.5 text-slate-700">{items.map((i) => <li key={i} className="flex gap-2"><span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${dot}`} />{i}</li>)}</ul>
    </div>
  );
}
