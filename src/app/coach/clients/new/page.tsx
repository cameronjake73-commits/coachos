import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Alert, Card, Field, PageHeader, Toggle } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { addClient } from '../actions';
import { addMonths } from '@/lib/coaching';

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).neq('status', 'archived');
  const full = (count ?? 0) >= coach.client_limit;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Add a client" back={{ href: '/coach/clients', label: 'Clients' }}
        description="They'll get an invite link to set up their app. You can edit everything later." />
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      {full && <Alert tone="amber" title={`You're using all ${coach.client_limit} client places`} action={<Link href="/coach/billing" className="btn-secondary btn-sm">Upgrade</Link>}>Archive a client or upgrade your plan to add another.</Alert>}

      <form action={addClient} className="space-y-5">
        <Card title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input name="full_name" required maxLength={120} autoComplete="off" className="input" /></Field>
            <Field label="Email"><input name="email" type="email" required inputMode="email" autoComplete="off" className="input" /></Field>
            <Field label="Phone (optional)"><input name="phone" type="tel" inputMode="tel" className="input" /></Field>
            <Field label="Start date"><input name="start_date" type="date" defaultValue={today} className="input" /></Field>
          </div>
        </Card>
        <Card title="Goal">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main goal" className="sm:col-span-2"><input name="goal" maxLength={300} placeholder="e.g. Lose 6kg and get stronger for summer" className="input" /></Field>
            <Field label="Target weight (kg, optional)"><input name="target_weight_kg" type="number" step="0.1" min="20" max="400" inputMode="decimal" className="input" /></Field>
            <Field label="Goal date (optional)"><input name="goal_deadline" type="date" className="input" /></Field>
          </div>
        </Card>
        <Card title="Payment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly fee (£)"><input name="monthly_fee" type="number" step="0.01" min="0" inputMode="decimal" className="input" /></Field>
            <Field label="Next renewal date" hint="Shown on your dashboard before it's due."><input name="renewal_date" type="date" defaultValue={addMonths(today, 1)} className="input" /></Field>
          </div>
        </Card>
        <Card title="Private notes">
          <textarea name="notes" rows={3} maxLength={5000} className="input" placeholder="Only you can see these." />
        </Card>
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Toggle name="send_email" defaultChecked label="Email the invite now" description="You'll also get a link to send by DM or WhatsApp." />
          <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Adding…">Add client</SubmitButton>
        </div>
      </form>
    </div>
  );
}
