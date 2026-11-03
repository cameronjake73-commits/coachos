import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { Alert, Badge, RiskBadge, Tabs, paymentTone, statusTone } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { SubmitButton } from '@/components/submit-button';
import { ConfirmButton } from '@/components/form-bits';
import { archiveClient, recordRenewal, restoreClient } from '../actions';
import { checkinStatus, clientAlerts } from '@/lib/coaching';
import { gbp, longDate } from '@/lib/format';
import type { Client } from '@/lib/types';
import { OverviewTab } from './_tabs/overview';
import { ProgressTab } from './_tabs/progress';
import { CheckinsTab } from './_tabs/checkins';
import { TrainingTab } from './_tabs/training';
import { NutritionTab } from './_tabs/nutrition';
import { MessagesTab } from './_tabs/messages';
import { TimelineTab } from './_tabs/timeline';
import { DetailsTab, InviteBox } from './_tabs/details';

const TABS = [
  ['overview', 'Overview'], ['progress', 'Progress'], ['check-ins', 'Check-ins'], ['training', 'Training'],
  ['nutrition', 'Nutrition'], ['messages', 'Messages'], ['timeline', 'Timeline'], ['details', 'Details'],
] as const;

type SP = { tab?: string; invited?: string; error?: string; draft?: string };

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === 'settings' ? 'details' : (TABS.map((t) => t[0]) as string[]).includes(sp.tab || '') ? sp.tab! : 'overview';
  const { supabase, coach } = await requireCoach();
  const { data: c } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const client = c as Client;

  const [{ data: last }, { count: progCount }, { count: nutCount }, { count: unread }, { count: pendingCount }] = await Promise.all([
    supabase.from('checkins').select('submitted_at').eq('client_id', id).order('submitted_at', { ascending: false }).limit(1),
    supabase.from('programs').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('is_active', true),
    supabase.from('nutrition_targets').select('client_id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('sender', 'client').is('read_at', null),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('client_id', id).eq('status', 'submitted'),
  ]);
  const status = client.status === 'active' ? checkinStatus(client, last?.[0]?.submitted_at, coach.checkin_day) : undefined;
  const alerts = clientAlerts(client, { status, hasProgramme: (progCount ?? 0) > 0, hasNutrition: (nutCount ?? 0) > 0, unread: tab === 'messages' ? 0 : unread ?? 0 });
  const base = `/coach/clients/${id}`;
  const archived = client.status === 'archived';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link href="/coach/clients" className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] text-slate-500 hover:text-slate-800"><Icon name="chevronLeft" className="h-4 w-4" />Clients</Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 md:gap-4">
          <Avatar name={client.full_name} size={52} />
          <div className="min-w-0">
            <h1 className="truncate">{client.full_name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {client.status === 'active' ? <RiskBadge level={client.risk_level} score={client.risk_score} /> : <Badge tone={statusTone(client.status)}>{client.status}</Badge>}
              {client.payment_status !== 'paid' && !archived && <Badge tone={paymentTone(client.payment_status)}>{client.payment_status}</Badge>}
              {client.monthly_fee ? <Badge>{gbp(client.monthly_fee)}/mo</Badge> : null}
              {client.renewal_date && !archived && <Badge>Renews {longDate(client.renewal_date)}</Badge>}
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] text-slate-500">{client.goal || 'No goal set'}{client.start_date ? ` · Client since ${longDate(client.start_date)}` : ''}</p>
          </div>
        </div>
        <div className="scroll-x -mx-4 shrink-0 gap-2 px-4 lg:mx-0 lg:px-0">
          {!archived && <Link href={`${base}?tab=messages`} className="btn-primary btn-sm"><Icon name="messages" className="h-4 w-4" />Message</Link>}
          {!archived && client.status !== 'invited' && (client.monthly_fee || client.renewal_date) ? (
            <form action={recordRenewal}><input type="hidden" name="client_id" value={id} /><input type="hidden" name="back" value={`${base}?tab=${tab}`} />
              <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…"><Icon name="check" className="h-4 w-4" />Record renewal</SubmitButton></form>
          ) : null}
          <Link href={`${base}?tab=details`} className="btn-secondary btn-sm"><Icon name="edit" className="h-4 w-4" />Edit</Link>
          <form>
            <input type="hidden" name="client_id" value={id} />
            {archived
              ? <ConfirmButton formAction={restoreClient} message={`Restore ${client.full_name}? They'll count towards your client places again.`} className="btn-secondary btn-sm"><Icon name="restore" className="h-4 w-4" />Restore</ConfirmButton>
              : <ConfirmButton formAction={archiveClient} message={`Archive ${client.full_name}? Their data is kept and you can restore them any time. Their app access stops working while archived.`} className="btn-ghost btn-sm"><Icon name="archive" className="h-4 w-4" />Archive</ConfirmButton>}
          </form>
        </div>
      </header>

      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      {client.status === 'invited' && tab !== 'details' && <InviteBox supabase={supabase} client={client} invited={sp.invited} />}
      {archived && <Alert tone="amber" title="Archived client">{client.archived_at ? `Archived on ${longDate(client.archived_at)}. ` : ''}Their history is kept. Restore them to coach them again.</Alert>}
      {!archived && alerts.length > 0 && tab === 'overview' && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {alerts.slice(0, 4).map((a) => (
            <li key={a.title} className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${a.tone === 'red' ? 'border-red-200 bg-red-50' : a.tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
              <Icon name={a.tone === 'blue' ? 'info' : 'alert'} className={`h-4 w-4 shrink-0 ${a.tone === 'red' ? 'text-red-400' : a.tone === 'amber' ? 'text-amber-400' : 'text-sky-400'}`} />
              <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{a.title}</span>{a.detail && <span className="block text-xs text-slate-600">{a.detail}</span>}</span>
              {a.href && a.action && <Link href={a.href} className="shrink-0 text-[13px] link">{a.action}</Link>}
            </li>
          ))}
        </ul>
      )}

      <Tabs items={TABS.map(([k, label]) => ({
        href: `${base}?tab=${k}`, label, active: tab === k,
        count: k === 'messages' ? unread ?? 0 : k === 'check-ins' ? pendingCount ?? 0 : undefined,
      }))} />

      <div className="animate-fade-in">
        {tab === 'overview' && <OverviewTab supabase={supabase} coach={coach} client={client} status={status} />}
        {tab === 'progress' && <ProgressTab supabase={supabase} client={client} />}
        {tab === 'check-ins' && <CheckinsTab supabase={supabase} client={client} status={status} />}
        {tab === 'training' && <TrainingTab supabase={supabase} coach={coach} client={client} />}
        {tab === 'nutrition' && <NutritionTab supabase={supabase} client={client} />}
        {tab === 'messages' && <MessagesTab supabase={supabase} coach={coach} client={client} draftMode={sp.draft} status={status} />}
        {tab === 'timeline' && <TimelineTab supabase={supabase} client={client} />}
        {tab === 'details' && <DetailsTab supabase={supabase} client={client} invited={sp.invited} />}
      </div>
    </div>
  );
}
