import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, Field, PageHeader, Toggle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { QuestionEditor } from '@/components/question-editor';
import { deleteCoachAccount, saveSettings } from './actions';
import { aiEnabled } from '@/lib/ai';
import { DAYS } from '@/lib/coaching';
import { MEASUREMENTS } from '@/lib/types';
import { QuickReplyEditor } from '@/components/quick-reply-editor';
import { DEFAULT_AUTO_REPLY, fmtTime, hoursFrom } from '@/lib/hours';

const TIMES = Array.from({ length: 38 }, (_, i) => { const m = 300 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach, user } = await requireCoach();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const ai = aiEnabled();
  const emailOn = Boolean(process.env.RESEND_API_KEY);
  const measured = new Set(coach.checkin_measurements ?? ['waist']);
  const hours = hoursFrom(coach);
  const hoursReady = coach.hours_days !== undefined; // migration 0006 has been run

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      <form action={saveSettings} className="space-y-5">
        <Card title="Your profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" hint="Used in your greeting and to sign AI drafts."><input name="full_name" required maxLength={120} defaultValue={profile?.full_name ?? ''} className="input" /></Field>
            <Field label="Business name" hint="Shown to your clients in their app."><input name="business_name" maxLength={120} defaultValue={coach.business_name ?? ''} className="input" /></Field>
            <Field label="Login email" className="sm:col-span-2"><input value={user.email ?? ''} readOnly disabled className="input opacity-70" /></Field>
          </div>
        </Card>

        <Card title="Weekly check-ins" description="What your clients are asked every week.">
          <div className="space-y-5">
            <Field label="Check-in day" hint="Clients can submit from 3 days before. Reminder emails go out on this day.">
              <select name="checkin_day" defaultValue={coach.checkin_day} className="input sm:max-w-xs">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </Field>
            <fieldset>
              <legend className="label">Body measurements</legend>
              <p className="hint mb-2 mt-0">Weight is always included. Pick any others you want clients to record.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MEASUREMENTS.map((m) => (
                  <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 text-sm has-[:checked]:border-brand-500/60 has-[:checked]:bg-brand-50 md:min-h-[38px]">
                    <input type="checkbox" name={`m_${m.id}`} defaultChecked={measured.has(m.id)} />{m.label} <span className="text-xs text-slate-500">({m.unit})</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <div className="label">Standard questions</div>
              <p className="text-[13px] text-slate-500">Training and nutrition adherence, sleep, sleep quality, energy, stress, hunger, daily steps, biggest win, biggest struggle, questions for you, and optional front/side/back photos.</p>
            </div>
            <div>
              <div className="label">Your extra questions</div>
              <QuestionEditor initial={coach.checkin_questions ?? []} />
            </div>
          </div>
        </Card>

        <section id="hours" className="scroll-mt-24">
          <Card title="Working hours & boundaries" description="Clients see when you reply, get an automatic message out of hours, and you stop getting pinged at night.">
            {!hoursReady ? (
              <Alert tone="amber" title="One quick setup step">Run <code className="rounded bg-black/30 px-1">supabase/migrations/0006_boundaries.sql</code> in Supabase → SQL Editor to switch this on.</Alert>
            ) : (
              <div className="space-y-5">
                <Toggle name="hours_enabled" defaultChecked={coach.hours_enabled} label="Use working hours" description="Outside these times clients see you're offline and when you'll be back. No message emails reach you out of hours; they're in your morning summary instead." />
                <fieldset>
                  <legend className="label">Days you reply</legend>
                  <div className="flex flex-wrap gap-2">
                    {DAY_ORDER.map((d) => (
                      <label key={d} className="flex min-h-[44px] min-w-[52px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium has-[:checked]:border-brand-500/60 has-[:checked]:bg-brand-50 has-[:checked]:text-slate-900 md:min-h-[38px]">
                        <input type="checkbox" name={`hd_${d}`} defaultChecked={hours.days.includes(d)} className="sr-only" />{DAYS[d].slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <Field label="From"><select name="hours_start" defaultValue={hours.start} className="input">{TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}</select></Field>
                  <Field label="Until"><select name="hours_end" defaultValue={hours.end} className="input">{TIMES.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}</select></Field>
                </div>
                <Field label="You reply within" hint="Shown to clients in their chat, so they know what to expect." className="sm:max-w-xs">
                  <select name="reply_within_hours" defaultValue={String(hours.replyWithin)} className="input">
                    {[[2, '2 hours'], [4, '4 hours'], [12, '12 hours'], [24, '1 working day'], [48, '2 working days']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <Toggle name="auto_reply_enabled" defaultChecked={coach.auto_reply_enabled ?? true} label="Automatic out-of-hours reply" description="Sent once when a client messages while you're offline, then not again until you've replied." />
                  <Field label="Auto-reply message" hint="{name} becomes their first name; {next} becomes when you're back, e.g. “tomorrow at 9am”.">
                    <textarea name="auto_reply_text" rows={3} maxLength={1000} className="input" defaultValue={coach.auto_reply_text ?? ''} placeholder={DEFAULT_AUTO_REPLY} />
                  </Field>
                </div>
                <div>
                  <div className="label">Saved replies</div>
                  <p className="hint mb-2 mt-0">Answer common messages in one tap from any chat. Includes a polite script for things outside your remit.</p>
                  <QuickReplyEditor initial={coach.quick_replies ?? []} />
                </div>
              </div>
            )}
          </Card>
        </section>

        <Card title="Notifications">
          <Toggle name="email_digest" defaultChecked={coach.email_digest} label="Morning summary email" description="When check-ins are waiting or clients are at risk." />
          <p className="mt-2 text-xs text-slate-500">Clients get a reminder on your check-in day if they haven&apos;t checked in, and an email when you reply. Turn reminders off per client in their Details.</p>
          {!emailOn && <div className="mt-3"><Alert tone="amber" title="Email isn't connected yet">Emails won&apos;t send until a RESEND_API_KEY is added in Vercel. Everything in the app still works.</Alert></div>}
        </Card>

        <section id="ai" className="scroll-mt-24">
          <Card title="AI assistant" action={ai ? <Badge tone="green"><Icon name="check" className="h-3 w-3" />Connected</Badge> : <Badge>Not connected</Badge>}>
            {!ai && (
              <div className="mb-4"><Alert tone="brand" title="Turn on AI client intelligence">
                Add an <code className="rounded bg-black/30 px-1">ANTHROPIC_API_KEY</code> in Vercel → Settings → Environment Variables, then redeploy. Until then, COACHOS uses its built-in rules for risk, priorities and message templates.
              </Alert></div>
            )}
            <Field label="How you write to clients" hint="Used to style AI-drafted replies. The assistant also learns from your three most recent replies.">
              <textarea name="ai_voice_notes" rows={4} maxLength={2000} className="input" defaultValue={coach.ai_voice_notes ?? ''}
                placeholder="Casual and upbeat, short paragraphs, use their first name, sign off with '– Coach Sam'. Direct about adherence but never harsh." />
            </Field>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li className="flex gap-2"><Icon name="lock" className="h-3.5 w-3.5 shrink-0" />Only first names and check-in data are sent to the AI provider. No emails, surnames or photos.</li>
              <li className="flex gap-2"><Icon name="info" className="h-3.5 w-3.5 shrink-0" />AI never sends anything or changes a plan. You review and approve every message.</li>
            </ul>
          </Card>
        </section>

        <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
          <SubmitButton className="btn-primary shadow-pop" pendingText="Saving…">Save settings</SubmitButton>
        </div>
      </form>

      <Card title="Delete account">
        <p className="text-[13px] text-slate-600">Cancels your subscription and permanently deletes your account, all clients, check-ins, photos, programmes and messages. Download any client data you need first (client → Details → Download all data).</p>
        <form action={deleteCoachAccount} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="del-acc">Type DELETE MY ACCOUNT</label>
          <input id="del-acc" name="confirm" placeholder="Type DELETE MY ACCOUNT" autoComplete="off" className="input sm:max-w-xs" />
          <SubmitButton className="btn-danger" pendingText="Deleting…">Delete everything</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
