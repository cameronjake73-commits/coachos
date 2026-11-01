import { requireCoach } from '@/lib/auth';
import { Card, Field } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { deleteCoachAccount, saveSettings } from './actions';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { coach } = await requireCoach();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1>Settings</h1>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}
      <form action={saveSettings} className="space-y-6">
        <Card title="Business">
          <Field label="Business name (shown to clients)"><input name="business_name" defaultValue={coach.business_name ?? ''} className="input" /></Field>
        </Card>
        <Card title="Weekly check-ins">
          <div className="space-y-4">
            <Field label="Check-in day">
              <select name="checkin_day" defaultValue={coach.checkin_day} className="input max-w-xs">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </Field>
            <p className="text-sm text-slate-500">Every check-in includes weight, waist, sleep, energy, stress, hunger, training and nutrition adherence, steps, wins, struggles, questions and optional photos.</p>
            <Field label="Extra questions (one per line, up to 10)">
              <textarea name="checkin_questions" rows={4} className="input" defaultValue={(coach.checkin_questions ?? []).map((q) => q.label).join('\n')}
                placeholder={'How was your digestion this week?\nAny upcoming events or holidays?'} />
            </Field>
          </div>
        </Card>
        <Card title="Email notifications">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email_digest" defaultChecked={coach.email_digest} /> Send me a morning summary when check-ins are waiting or clients are at risk</label>
          <p className="mt-2 text-xs text-slate-500">Clients automatically get a reminder email on your check-in day if they haven&apos;t checked in, plus an email when you reply. You can turn reminders off per client.</p>
        </Card>
        <Card title="AI assistant voice">
          <Field label="Describe how you write to clients">
            <textarea name="ai_voice_notes" rows={4} className="input" defaultValue={coach.ai_voice_notes ?? ''}
              placeholder="Casual and upbeat, short paragraphs, use their first name, sign off with '– Coach Sam'. Direct about adherence but never harsh." />
          </Field>
          <p className="mt-2 text-xs text-slate-500">The assistant also learns from your three most recent check-in replies. Only first names and check-in data are sent to the AI provider, and it does not train on your data.</p>
        </Card>
        <SubmitButton>Save settings</SubmitButton>
      </form>
      <Card title="Delete account">
        <p className="text-sm text-slate-600">Cancels your subscription and permanently deletes your account, all clients, check-ins, photos, programmes and messages. Export any client data you need first (client → Settings → Download data).</p>
        <form action={deleteCoachAccount} className="mt-3 flex flex-wrap gap-2">
          <input name="confirm" placeholder="Type DELETE MY ACCOUNT" className="input max-w-xs" />
          <SubmitButton className="btn-danger" pendingText="Deleting…">Delete everything</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
