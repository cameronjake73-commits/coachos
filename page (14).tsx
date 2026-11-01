import Link from 'next/link';
import { requireCoach } from '@/lib/auth';
import { Badge, Card, Empty, RiskBadge } from '@/components/ui';
import { Avatar } from '@/components/avatar';
import { SubmitButton } from '@/components/submit-button';
import { addClient } from './actions';
import { gbp, shortDate } from '@/lib/format';
import type { Client } from '@/lib/types';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string; show?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  let q = supabase.from('clients').select('*').eq('coach_id', coach.id).order('full_name');
  q = sp.show === 'archived' ? q.eq('status', 'archived') : q.neq('status', 'archived');
  if (sp.q?.trim()) q = q.or(`full_name.ilike.%${sp.q.trim().replace(/[%,()]/g, '')}%,email.ilike.%${sp.q.trim().replace(/[%,()]/g, '')}%`);
  const { data } = await q;
  const clients = (data ?? []) as Client[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1>{sp.q ? `Clients matching “${sp.q}”` : 'Clients'}</h1>
        <Link href={sp.show === 'archived' ? '/coach/clients' : '/coach/clients?show=archived'} className="text-sm link">
          {sp.show === 'archived' ? 'Show current' : 'Show archived'}
        </Link>
      </div>
      {sp.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-x-auto p-0">
          {clients.length === 0 ? <div className="p-5"><Empty>No clients yet. Add your first one and send them their invite link.</Empty></div> : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Client</th><th className="p-3">Status</th><th className="p-3">Risk</th><th className="p-3">Fee</th><th className="p-3">Renews</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3"><Link href={`/coach/clients/${c.id}`} className="flex items-center gap-3"><Avatar name={c.full_name} size={34} />
                      <span><span className="font-medium hover:underline">{c.full_name}</span><span className="block text-xs text-slate-500">{c.goal || c.email}</span></span></Link></td>
                    <td className="p-3"><Badge tone={c.status === 'active' ? 'green' : c.status === 'invited' ? 'blue' : 'slate'}>{c.status}</Badge>
                      {c.payment_status === 'overdue' && <span className="ml-1"><Badge tone="red">overdue</Badge></span>}</td>
                    <td className="p-3">{c.status === 'active' ? <RiskBadge level={c.risk_level} score={c.risk_score} /> : '—'}</td>
                    <td className="p-3">{gbp(c.monthly_fee)}</td>
                    <td className="p-3">{shortDate(c.renewal_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Add a client">
          <form action={addClient} className="space-y-3">
            <label className="block"><span className="label">Full name</span><input name="full_name" required className="input" /></label>
            <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
            <label className="block"><span className="label">Goal</span><input name="goal" className="input" placeholder="e.g. Lose 6kg for summer" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Monthly fee (£)</span><input name="monthly_fee" type="number" step="0.01" min="0" className="input" /></label>
              <label className="block"><span className="label">Next renewal</span><input name="renewal_date" type="date" className="input" /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="send_email" defaultChecked /> Email the invite to them now</label>
            <SubmitButton className="btn-primary w-full">Add client & create invite</SubmitButton>
            <p className="text-xs text-slate-500">{clients.filter((c) => c.status !== 'archived').length} of {coach.client_limit} client places used.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
