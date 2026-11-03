import type { SupabaseClient } from '@supabase/supabase-js';
import { Alert, Card, Field, Toggle } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { CopyLink } from '@/components/copy-link';
import { deleteClientData, emailInvite, newInvite, updateClient } from '../../actions';
import { longDate } from '@/lib/format';
import type { Client } from '@/lib/types';

export async function InviteBox({ supabase, client, invited }: { supabase: SupabaseClient; client: Client; invited?: string }) {
  const { data: inv } = await supabase.from('invites').select('token, expires_at, accepted_at').eq('client_id', client.id)
    .is('accepted_at', null).order('created_at', { ascending: false }).limit(1);
  const invite = inv?.[0];
  const valid = invite && new Date(invite.expires_at) > new Date();
  const url = valid ? `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}` : null;
  const emailed = invited === 'emailed';
  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 md:p-5">
      <h2>{invited ? 'Client added. Send them their invite link' : `Waiting for ${client.full_name.split(' ')[0]} to join`}</h2>
      {url ? (
        <>
          <p className="mt-1 text-[13px] text-slate-700">{emailed ? `Invite emailed to ${client.email}. ` : ''}Send this link by DM, WhatsApp or email. It expires {longDate(invite!.expires_at)}.</p>
          <div className="mt-3"><CopyLink url={url} /></div>
          <form action={emailInvite} className="mt-2"><input type="hidden" name="client_id" value={client.id} /><SubmitButton className="btn-ghost btn-sm -ml-2 text-brand-700" pendingText="Sending…">{emailed ? 'Resend invite email' : 'Email the invite instead'}</SubmitButton></form>
        </>
      ) : (
        <form action={newInvite} className="mt-3 flex flex-wrap items-center gap-3"><input type="hidden" name="client_id" value={client.id} />
          <p className="w-full text-[13px] text-slate-700">The last invite link has expired.</p>
          <Toggle name="send_email" defaultChecked label="Email it to them" />
          <SubmitButton className="btn-secondary">Create new invite link</SubmitButton></form>
      )}
    </section>
  );
}

export async function DetailsTab({ supabase, client, invited }: { supabase: SupabaseClient; client: Client; invited?: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {client.status === 'invited' && <InviteBox supabase={supabase} client={client} invited={invited} />}
      <form action={updateClient} className="space-y-5">
        <input type="hidden" name="client_id" value={client.id} />
        <Card title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input name="full_name" required maxLength={120} defaultValue={client.full_name} className="input" /></Field>
            <Field label="Email" hint={client.user_id ? 'Their login email stays the same.' : undefined}><input name="email" type="email" defaultValue={client.email} className="input" /></Field>
            <Field label="Phone"><input name="phone" type="tel" defaultValue={client.phone ?? ''} className="input" /></Field>
            <Field label="Start date"><input name="start_date" type="date" defaultValue={client.start_date ?? ''} className="input" /></Field>
          </div>
        </Card>
        <Card title="Goal">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main goal" className="sm:col-span-2"><input name="goal" maxLength={300} defaultValue={client.goal ?? ''} className="input" /></Field>
            <Field label="Target weight (kg)"><input name="target_weight_kg" type="number" step="0.1" inputMode="decimal" defaultValue={client.target_weight_kg ?? ''} className="input" /></Field>
            <Field label="Goal date"><input name="goal_deadline" type="date" defaultValue={client.goal_deadline ?? ''} className="input" /></Field>
          </div>
        </Card>
        <Card title="Coaching & payment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select name="status" defaultValue={client.status} className="input">
                {client.status === 'invited' && <option value="invited">Invited (not joined yet)</option>}
                {client.status !== 'invited' && <option value="active">Active</option>}
                <option value="paused">Paused</option><option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Payment status">
              <select name="payment_status" defaultValue={client.payment_status} className="input">
                <option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Monthly fee (£)"><input name="monthly_fee" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={client.monthly_fee ?? ''} className="input" /></Field>
            <Field label="Next renewal date"><input name="renewal_date" type="date" defaultValue={client.renewal_date ?? ''} className="input" /></Field>
            <div className="sm:col-span-2"><Toggle name="email_reminders" defaultChecked={client.email_reminders} label="Weekly check-in reminder emails" description="Sent on your check-in day if they haven't checked in yet." /></div>
          </div>
        </Card>
        <Card title="Private notes" description="Only you can see these.">
          <textarea name="notes" rows={5} maxLength={5000} defaultValue={client.notes ?? ''} className="input" />
        </Card>
        <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
          <SubmitButton className="btn-primary shadow-pop" pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </form>

      <Card title="Their data" description="UK GDPR: you can give clients a copy of their data or erase it on request.">
        <a href={`/api/export/client/${client.id}`} className="btn-secondary">Download all data (JSON)</a>
        <div className="mt-5 border-t border-slate-200 pt-5">
          <h3 className="text-red-700">Delete client and all data</h3>
          <p className="mt-1 text-[13px] text-slate-600">Permanently erases {client.full_name.split(' ')[0]}&apos;s account, check-ins, photos, workouts and messages. This cannot be undone. To stop coaching someone but keep their history, archive them instead.</p>
          <form action={deleteClientData} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="client_id" value={client.id} />
            <label className="sr-only" htmlFor="confirm-del">Type DELETE to confirm</label>
            <input id="confirm-del" name="confirm" placeholder="Type DELETE" autoComplete="off" className="input max-w-[200px]" />
            <SubmitButton className="btn-danger" pendingText="Deleting…">Delete permanently</SubmitButton>
          </form>
        </div>
      </Card>
      {client.health_consent_at ? null : client.status !== 'invited' && <Alert tone="amber">No health data consent recorded for this client.</Alert>}
    </div>
  );
}
