import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, PageHeader, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PLANS } from '@/lib/plans';
import { daysUntil, longDate } from '@/lib/format';

const FEATURES = ['Client app for workouts, check-ins and messages', 'Retention alerts and missed check-in tracking', 'AI check-in summaries and drafted replies', 'Programme builder and exercise library', 'Progress photos and measurements'];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).neq('status', 'archived');
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY) && Object.values(PLANS).every((p) => process.env[p.envPrice]);
  const used = count ?? 0;
  const trialLeft = coach.plan === 'trial' ? Math.max(0, daysUntil(coach.trial_ends_at) ?? 0) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Billing" />
      {sp.success && <Alert tone="green" title="Thank you!">Your subscription is being activated. It can take a few seconds to show here.</Alert>}
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      {!stripeReady && (
        <Alert tone="amber" title="Payments aren't connected yet">
          Plan buttons are disabled until Stripe is set up. Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the three STRIPE_PRICE_ keys in Vercel, then redeploy.
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] text-slate-500">Current plan</div>
            <div className="mt-0.5 flex items-center gap-2 text-xl font-semibold">{coach.plan === 'trial' ? 'Free trial' : PLANS[coach.plan].name}
              <Badge tone={['active', 'trialing'].includes(coach.subscription_status) ? 'green' : 'amber'}>{coach.subscription_status.replace('_', ' ')}</Badge></div>
            {coach.plan === 'trial' && <p className="mt-1 text-[13px] text-slate-500">{trialLeft} day{trialLeft === 1 ? '' : 's'} left · ends {longDate(coach.trial_ends_at)}</p>}
          </div>
          {coach.stripe_customer_id && stripeReady && (
            <form action="/api/stripe/portal" method="post"><button className="btn-secondary"><Icon name="external" className="h-4 w-4" />Manage billing & invoices</button></form>
          )}
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-slate-600">Client places</span><span className="num">{used} / {coach.client_limit}</span></div>
          <ProgressBar value={(used / coach.client_limit) * 100} tone={used >= coach.client_limit ? 'red' : used / coach.client_limit > 0.8 ? 'amber' : 'brand'} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(PLANS).map(([key, p]) => {
          const current = coach.plan === key;
          const popular = key === 'growth';
          return (
            <div key={key} className={`card relative flex flex-col ${current ? 'ring-2 ring-brand-500' : popular ? 'border-brand-200' : ''}`}>
              {popular && !current && <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2 py-0.5 text-2xs font-semibold text-white">Most popular</span>}
              <div className="font-semibold">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1"><span className="num text-3xl font-bold tracking-tight">£{p.priceGbp}</span><span className="text-sm text-slate-500">/month</span></div>
              <div className="mt-1 text-[13px] text-slate-600">Up to {p.clientLimit} active clients</div>
              <ul className="mt-4 flex-1 space-y-2 text-[13px] text-slate-700">
                {FEATURES.map((f) => <li key={f} className="flex gap-2"><Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.4} />{f}</li>)}
              </ul>
              <form action="/api/stripe/checkout" method="post" className="mt-5">
                <input type="hidden" name="plan" value={key} />
                <button className={current ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={current || !stripeReady || used > p.clientLimit}
                  title={used > p.clientLimit ? `You have ${used} clients. Archive some to move to this plan.` : undefined}>
                  {current ? 'Current plan' : coach.stripe_customer_id && coach.plan !== 'trial' ? 'Switch plan' : 'Choose plan'}
                </button>
              </form>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-500">Payments are handled securely by Stripe. Cancel any time from &quot;Manage billing&quot;.</p>
    </div>
  );
}
