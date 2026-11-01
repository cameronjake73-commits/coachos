import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, Empty, Field, RiskBadge, Sparkline } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { CopyLink } from '@/components/copy-link';
import { deleteClientData, emailInvite, newInvite, saveNutrition, sendCoachMessage, updateClient } from '../actions';
import { AutoRefresh } from '@/components/auto-refresh';
import { assignTemplate, createProgram } from '../../programs/actions';
import { gbp, longDate, shortDate } from '@/lib/format';
import { draftOutreach } from '@/lib/dashboard-data';
import { Avatar } from '@/components/avatar';
import type { Checkin, Client } from '@/lib/types';

const TABS = ['overview', 'check-ins', 'training', 'nutrition', 'messages', 'settings'] as const;
const TAB_LABELS: Record<string, string> = { overview: 'Overview', 'check-ins': 'Check-ins', training: 'Training', nutrition: 'Nutrition', messages: 'Messages', settings: 'Settings' };
const ONBOARDING_LABELS: [string, string][] = [
  ['main_goal', 'Main goal'], ['why_now', 'Why now'], ['age', 'Age'], ['height_cm', 'Height (cm)'], ['starting_weight_kg', 'Starting weight (kg)'],
  ['training_experience', 'Training experience'], ['training_days_per_week', 'Days per week'], ['equipment', 'Where they train'],
  ['injuries', 'Injuries / medical'], ['diet', 'Diet'], ['lifestyle', 'Lifestyle'],
];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; invited?: string; error?: string; draft?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab || '') ? sp.tab! : 'overview';
  const { supabase, coach } = await requireCoach();
  const { data: c } = await supabase.from('clients').select('*').eq('id', id).single();
  if (!c) notFound();
  const client = c as Client;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/coach/clients" className="text-sm text-slate-500 hover:underline">← Clients</Link>
          <div className="mt-2 flex items-center gap-3"><Avatar name={client.full_name} size={44} /><h1>{client.full_name}</h1></div>
          <p className="text-sm text-slate-500">{client.goal || 'No goal set'} · {client.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={client.status === 'active' ? 'green' : client.status === 'invited' ? 'blue' : 'slate'}>{client.status}</Badge>
          {client.status === 'active' && <RiskBadge level={client.risk_level} score={client.risk_score} />}
          {client.monthly_fee ? <Badge>{gbp(client.monthly_fee)}/mo</Badge> : null}
          <Badge tone={client.payment_status === 'paid' ? 'green' : client.payment_status === 'overdue' ? 'red' : 'amber'}>{client.payment_status}</Badge>
        </div>
      </div>

      {client.status === 'invited' && <InviteBox clientId={client.id} justCreated={!!sp.invited} emailed={sp.invited === 'emailed'} />}
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <Link key={t} href={`/coach/clients/${id}?tab=${t}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{TAB_LABELS[t]}</Link>
        ))}
      </nav>

      {tab === 'overview' && <Overview client={client} />}
      {tab === 'check-ins' && <CheckinsTab clientId={id} />}
      {tab === 'training' && <TrainingTab clientId={id} coachId={coach.id} />}
      {tab === 'nutrition' && <NutritionTab clientId={id} />}
      {tab === 'messages' && <MessagesTab clientId={id} draft={sp.draft ? draftOutreach(client, await coachFirstName()) : ''} />}
      {tab === 'settings' && <SettingsTab client={client} />}
    </div>
  );

  async function InviteBox({ clientId, justCreated, emailed }: { clientId: string; justCreated: boolean; emailed: boolean }) {
    const { data: inv } = await supabase.from('invites').select('token, expires_at, accepted_at').eq('client_id', clientId)
      .is('accepted_at', null).order('created_at', { ascending: false }).limit(1);
    const invite = inv?.[0];
    const valid = invite && new Date(invite.expires_at) > new Date();
    const url = valid ? `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}` : null;
    return (
      <Card>
        <h2 className="text-base">{justCreated ? 'Client added. Send them their invite link' : 'Waiting for client to join'}</h2>
        {url ? (
          <>
            <p className="mt-1 text-sm text-slate-600">{emailed ? `Invite emailed to ${client.email}. You can also send this link by DM or WhatsApp.` : 'Send this link by DM, WhatsApp or email.'} It expires {longDate(invite!.expires_at)}.</p>
            <div className="mt-3"><CopyLink url={url} /></div>
            <form action={emailInvite} className="mt-2"><input type="hidden" name="client_id" value={clientId} /><SubmitButton className="text-sm link" pendingText="Sending…">{emailed ? 'Resend invite email' : 'Email invite to client'}</SubmitButton></form>
          </>
        ) : (
          <form action={newInvite} className="mt-3 flex items-center gap-3"><input type="hidden" name="client_id" value={clientId} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="send_email" defaultChecked /> Email it</label>
            <SubmitButton className="btn-secondary">Create new invite link</SubmitButton></form>
        )}
      </Card>
    );
  }

  async function Overview({ client }: { client: Client }) {
    const [{ data: cis }, { data: photos }, { count: logs14 }] = await Promise.all([
      supabase.from('checkins').select('submitted_at, weight_kg, waist_cm, training_adherence, nutrition_adherence, energy, sleep_hours').eq('client_id', client.id).order('submitted_at').limit(16),
      supabase.from('progress_photos').select('storage_path, pose, taken_at').eq('client_id', client.id).order('taken_at', { ascending: false }).limit(6),
      supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('completed_at', new Date(Date.now() - 14 * 864e5).toISOString()),
    ]);
    const series = (k: string) => (cis ?? []).map((r) => (r as Record<string, number | null>)[k]);
    const signed = photos?.length ? (await supabase.storage.from('progress-photos').createSignedUrls(photos.map((p) => p.storage_path), 600)).data : [];
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Risk signals">
          {client.risk_reasons.length ? <ul className="space-y-1 text-sm">{client.risk_reasons.map((r) => <li key={r}>• {r}</li>)}</ul> : <Empty>No warning signs.</Empty>}
          <p className="mt-3 text-xs text-slate-400">Updated {client.risk_updated_at ? shortDate(client.risk_updated_at) : 'never'} · {logs14 ?? 0} workouts logged in 14 days</p>
        </Card>
        <Card title="Trends">
          <div className="space-y-3 text-sm">
            <div><div className="text-slate-500">Weight</div><Sparkline values={series('weight_kg')} unit="kg" /></div>
            <div><div className="text-slate-500">Waist</div><Sparkline values={series('waist_cm')} unit="cm" /></div>
            <div><div className="text-slate-500">Training adherence</div><Sparkline values={series('training_adherence')} unit="%" /></div>
            <div><div className="text-slate-500">Nutrition adherence</div><Sparkline values={series('nutrition_adherence')} unit="%" /></div>
            <div><div className="text-slate-500">Energy</div><Sparkline values={series('energy')} unit="/10" /></div>
          </div>
        </Card>
        <Card title="Onboarding answers">
          {Object.keys(client.onboarding || {}).length ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{ONBOARDING_LABELS.filter(([k]) => client.onboarding[k] != null).map(([k, label]) => (
              <div key={k} className={['main_goal', 'why_now', 'injuries', 'diet', 'lifestyle', 'training_experience'].includes(k) ? 'col-span-2' : ''}>
                <dt className="text-slate-500">{label}</dt><dd>{String(client.onboarding[k]) || '—'}</dd></div>
            ))}</dl>
          ) : <Empty>Not completed yet.</Empty>}
          <p className="mt-3 text-xs text-slate-400">Health data consent: {client.health_consent_at ? longDate(client.health_consent_at) : 'not given'}</p>
        </Card>
        <Card title="Latest progress photos">
          {signed?.length ? (
            <div className="grid grid-cols-3 gap-2">{signed.map((s, i) => s.signedUrl && (
              <figure key={i}><img src={s.signedUrl} alt={photos![i].pose ?? ''} className="aspect-[3/4] w-full rounded-lg object-cover" />
                <figcaption className="mt-1 text-xs text-slate-500">{photos![i].pose} · {shortDate(photos![i].taken_at)}</figcaption></figure>
            ))}</div>
          ) : <Empty>No photos yet.</Empty>}
        </Card>
      </div>
    );
  }

  async function CheckinsTab({ clientId }: { clientId: string }) {
    const { data } = await supabase.from('checkins').select('*').eq('client_id', clientId).order('submitted_at', { ascending: false });
    const rows = (data ?? []) as Checkin[];
    return (
      <Card className="overflow-x-auto p-0">
        {!rows.length ? <div className="p-5"><Empty>No check-ins yet.</Empty></div> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500"><tr>
              <th className="p-3">Date</th><th className="p-3">Weight</th><th className="p-3">Waist</th><th className="p-3">Training</th><th className="p-3">Nutrition</th><th className="p-3">Energy</th><th className="p-3">Sleep</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3">{shortDate(r.submitted_at)}</td><td className="p-3">{r.weight_kg ?? '—'}</td><td className="p-3">{r.waist_cm ?? '—'}</td>
                <td className="p-3">{r.training_adherence != null ? `${r.training_adherence}%` : '—'}</td><td className="p-3">{r.nutrition_adherence != null ? `${r.nutrition_adherence}%` : '—'}</td>
                <td className="p-3">{r.energy ?? '—'}</td><td className="p-3">{r.sleep_hours ?? '—'}h</td>
                <td className="p-3"><Link href={`/coach/checkins/${r.id}`} className="link">{r.status === 'submitted' ? 'Review' : 'View'}</Link></td>
              </tr>))}</tbody>
          </table>
        )}
      </Card>
    );
  }

  async function TrainingTab({ clientId, coachId }: { clientId: string; coachId: string }) {
    const [{ data: progs }, { data: templates }, { data: logs }] = await Promise.all([
      supabase.from('programs').select('id, name, is_active, workouts(id)').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('programs').select('id, name').eq('coach_id', coachId).is('client_id', null).order('name'),
      supabase.from('workout_logs').select('id, workout_name, completed_at, session_rpe, notes, set_logs(exercise_name, set_number, reps, weight_kg)').eq('client_id', clientId).order('completed_at', { ascending: false }).limit(10),
    ]);
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Programmes">
          {!progs?.length ? <Empty>No programme assigned.</Empty> : (
            <ul className="space-y-2">{progs.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div><Link href={`/coach/programs/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <div className="text-xs text-slate-500">{p.workouts?.length ?? 0} workouts</div></div>
                {p.is_active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>}
              </li>))}</ul>
          )}
          <div className="mt-4 space-y-3 border-t pt-4">
            {templates?.length ? (
              <form action={assignTemplate} className="flex gap-2">
                <input type="hidden" name="client_id" value={clientId} />
                <select name="template_id" className="input" required>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <SubmitButton className="btn-secondary whitespace-nowrap">Assign template</SubmitButton>
              </form>
            ) : null}
            <form action={createProgram} className="flex gap-2">
              <input type="hidden" name="client_id" value={clientId} />
              <input name="name" required placeholder="New programme name" className="input" />
              <SubmitButton className="btn-primary whitespace-nowrap">Create</SubmitButton>
            </form>
          </div>
        </Card>
        <Card title="Recent workouts logged">
          {!logs?.length ? <Empty>No workouts logged yet.</Empty> : (
            <ul className="space-y-3">{logs.map((l) => (
              <li key={l.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex justify-between"><span className="font-medium">{l.workout_name}</span><span className="text-slate-500">{shortDate(l.completed_at)}{l.session_rpe ? ` · RPE ${l.session_rpe}` : ''}</span></div>
                <div className="mt-1 text-xs text-slate-600">{summariseSets(l.set_logs ?? [])}</div>
                {l.notes && <p className="mt-1 text-xs italic text-slate-500">“{l.notes}”</p>}
              </li>))}</ul>
          )}
        </Card>
      </div>
    );
  }

  async function NutritionTab({ clientId }: { clientId: string }) {
    const { data: n } = await supabase.from('nutrition_targets').select('*').eq('client_id', clientId).maybeSingle();
    return (
      <Card title="Nutrition targets & habits">
        <form action={saveNutrition} className="space-y-4">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Calories"><input name="calories" type="number" defaultValue={n?.calories ?? ''} className="input" /></Field>
            <Field label="Protein (g)"><input name="protein_g" type="number" defaultValue={n?.protein_g ?? ''} className="input" /></Field>
            <Field label="Carbs (g)"><input name="carbs_g" type="number" defaultValue={n?.carbs_g ?? ''} className="input" /></Field>
            <Field label="Fat (g)"><input name="fat_g" type="number" defaultValue={n?.fat_g ?? ''} className="input" /></Field>
            <Field label="Water (L)"><input name="water_l" type="number" step="0.1" defaultValue={n?.water_l ?? ''} className="input" /></Field>
          </div>
          <Field label="Daily habits (one per line)"><textarea name="habits" rows={4} defaultValue={(n?.habits ?? []).join('\n')} className="input" placeholder={'8,000 steps\n7+ hours sleep\nProtein at every meal'} /></Field>
          <Field label="Notes for client"><textarea name="notes" rows={3} defaultValue={n?.notes ?? ''} className="input" /></Field>
          <SubmitButton>Save targets</SubmitButton>
        </form>
      </Card>
    );
  }

  async function coachFirstName() {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', coach.id).single();
    return (data?.full_name || 'Coach').split(' ')[0];
  }

  async function MessagesTab({ clientId, draft }: { clientId: string; draft: string }) {
    const { data: msgs } = await supabase.from('messages').select('*').eq('client_id', clientId).order('created_at').limit(200);
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('client_id', clientId).eq('sender', 'client').is('read_at', null);
    return (
      <Card>
        {!draft && <AutoRefresh seconds={15} />}
        {draft && <p className="mb-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-100">Draft message ready below. Edit it so it sounds like you, then send.</p>}
        <div className="max-h-[480px] space-y-2 overflow-y-auto">
          {!msgs?.length ? <Empty>No messages yet.</Empty> : msgs.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'coach' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.sender === 'coach' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}>
                {m.body}<div className={`mt-1 text-[10px] ${m.sender === 'coach' ? 'text-brand-100' : 'text-slate-400'}`}>{new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
            </div>
          ))}
        </div>
        <form action={sendCoachMessage} className="mt-4 flex gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <textarea name="body" required rows={draft ? 8 : 2} className="input" placeholder="Write a message…" defaultValue={draft} />
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
        </form>
      </Card>
    );
  }

  function SettingsTab({ client }: { client: Client }) {
    return (
      <div className="space-y-6">
        <Card title="Client details">
          <form action={updateClient} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="client_id" value={client.id} />
            <Field label="Full name"><input name="full_name" defaultValue={client.full_name} className="input" /></Field>
            <Field label="Goal"><input name="goal" defaultValue={client.goal ?? ''} className="input" /></Field>
            <Field label="Monthly fee (£)"><input name="monthly_fee" type="number" step="0.01" defaultValue={client.monthly_fee ?? ''} className="input" /></Field>
            <Field label="Next renewal date"><input name="renewal_date" type="date" defaultValue={client.renewal_date ?? ''} className="input" /></Field>
            <Field label="Payment status">
              <select name="payment_status" defaultValue={client.payment_status} className="input">
                <option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={client.status} className="input">
                {client.status === 'invited' && <option value="invited">Invited</option>}
                <option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="email_reminders" defaultChecked={client.email_reminders} /> Email weekly check-in reminders to this client</label>
            <div className="sm:col-span-2"><Field label="Private notes"><textarea name="notes" rows={4} defaultValue={client.notes ?? ''} className="input" /></Field></div>
            <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
          </form>
        </Card>
        <Card title="Download client data">
          <p className="text-sm text-slate-600">Everything held about this client as a file (for data access requests, or if they move coach).</p>
          <a href={`/api/export/client/${client.id}`} className="btn-secondary mt-3">Download data (JSON)</a>
        </Card>
        <Card title="Delete client and all data">
          <p className="text-sm text-slate-600">Permanently erases this client&apos;s account, check-ins, photos, workouts and messages (GDPR right to erasure). This cannot be undone.</p>
          <form action={deleteClientData} className="mt-3 flex gap-2">
            <input type="hidden" name="client_id" value={client.id} />
            <input name="confirm" placeholder="Type DELETE" className="input max-w-[200px]" />
            <SubmitButton className="btn-danger" pendingText="Deleting…">Delete permanently</SubmitButton>
          </form>
        </Card>
      </div>
    );
  }
}

function summariseSets(sets: { exercise_name: string; set_number: number; reps: number | null; weight_kg: number | null }[]) {
  const by = new Map<string, string[]>();
  for (const s of [...sets].sort((a, b) => a.set_number - b.set_number)) {
    const arr = by.get(s.exercise_name) ?? [];
    arr.push(`${s.weight_kg ?? 0}kg×${s.reps ?? 0}`);
    by.set(s.exercise_name, arr);
  }
  return [...by.entries()].map(([n, v]) => `${n}: ${v.join(', ')}`).join(' · ') || 'No sets recorded';
}
