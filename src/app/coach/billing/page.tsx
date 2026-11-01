import { requireCoach } from '@/lib/auth';
import { Badge, Card } from '@/components/ui';
import { PLANS } from '@/lib/plans';
import { longDate } from '@/lib/format';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).neq('status', 'archived');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1>Billing</h1>
      {sp.success && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Thanks! Your subscription is being activated. It can take a few seconds to show here.</p>}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Current plan</div>
            <div className="text-xl font-semibold capitalize">{coach.plan === 'trial' ? 'Free trial' : PLANS[coach.plan].name}</div>
            <div className="text-sm text-slate-500">
              {count ?? 0} of {coach.client_limit} clients
              {coach.plan === 'trial' && ` · trial ends ${longDate(coach.trial_ends_at)}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={['active', 'trialing'].includes(coach.subscription_status) ? 'green' : 'amber'}>{coach.subscription_status.replace('_', ' ')}</Badge>
            {coach.stripe_customer_id && (
              <form action="/api/stripe/portal" method="post"><button className="btn-secondary">Manage billing & invoices</button></form>
            )}
          </div>
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(PLANS).map(([key, p]) => {
          const current = coach.plan === key;
          return (
            <div key={key} className={`card text-center ${current ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="font-semibold">{p.name}</div>
              <div className="mt-2 text-3xl font-bold">£{p.priceGbp}<span className="text-sm font-normal text-slate-500">/mo</span></div>
              <div className="text-sm text-slate-600">Up to {p.clientLimit} clients</div>
              <form action="/api/stripe/checkout" method="post" className="mt-4">
                <input type="hidden" name="plan" value={key} />
                <button className={current ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={current}>{current ? 'Current plan' : coach.stripe_customer_id && coach.plan !== 'trial' ? 'Switch plan' : 'Choose'}</button>
              </form>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Payments are handled securely by Stripe. Cancel any time from &quot;Manage billing&quot;.</p>
    </div>
  );
}
