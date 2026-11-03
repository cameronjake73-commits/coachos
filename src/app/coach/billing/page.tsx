import { requireCoach } from '@/lib/auth';
import { Alert, Badge, Card, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { FEATURES, FOUNDING, PLANS, foundingOpen, stripeReady } from '@/lib/plans';
import { daysUntil, longDate } from '@/lib/format';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, coach } = await requireCoach();
  const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('coach_id', coach.id).neq('status', 'archived');
  const ready = stripeReady();
  const founding = foundingOpen();
  const subscribed = coach.plan !== 'trial' && ['active', 'trialing', 'past_due'].includes(coach.subscription_status);
  const trialLeft = coach.plan === 'trial' ? Math.max(0, daysUntil(coach.trial_ends_at) ?? 0) : null;
  const plan = PLANS.pro;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Billing" />
      {sp.success && <Alert tone="green" title="Welcome aboard!">Your subscription is being activated. It can take a few seconds to show here.</Alert>}
      {sp.error && <Alert tone="red">{sp.error}</Alert>}
      {!ready && (
        <Alert tone="amber" title="Payments aren't connected yet">
          Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_PRO (plus STRIPE_PRICE_FOUNDING for the founding offer) in Vercel, then redeploy.
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[13px] text-slate-500">Your plan</div>
            <div className="mt-0.5 flex items-center gap-2 text-xl font-semibold">
              {subscribed ? plan.name : 'Free trial'}
              <Badge tone={['active', 'trialing'].includes(coach.subscription_status) ? 'green' : 'amber'}>{coach.subscription_status.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {coach.plan === 'trial' ? `${trialLeft} day${trialLeft === 1 ? '' : 's'} left · ends ${longDate(coach.trial_ends_at)} · ` : ''}{count ?? 0} client{count === 1 ? '' : 's'}
            </p>
          </div>
          {coach.stripe_customer_id && ready && (
            <form action="/api/stripe/portal" method="post"><button className="btn-secondary"><Icon name="external" className="h-4 w-4" />Manage billing & invoices</button></form>
          )}
        </div>
      </Card>

      {!subscribed && (
        <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-[#1a1442] via-[#131530] to-surface p-5 shadow-glow md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-sm">
              <h2 className="text-xl">{plan.name}</h2>
              <p className="mt-1 text-[13px] text-slate-600">One plan. Every feature. Unlimited clients.</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                {FEATURES.map((f) => <li key={f} className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.4} />{f}</li>)}
              </ul>
            </div>
            <div className="w-full space-y-3 sm:w-64">
              {founding ? (
                <div className="rounded-2xl border border-brand-500/50 bg-brand-50 p-4">
                  <Badge tone="brand">Founding member</Badge>
                  <div className="mt-2 flex items-baseline gap-2"><span className="num text-3xl font-bold">£{FOUNDING.priceGbp}</span><span className="text-sm text-slate-500">/month</span><span className="num text-sm text-slate-500 line-through">£{plan.priceGbp}</span></div>
                  <p className="mt-1 text-xs text-slate-600">For our first {FOUNDING.spots} coaches. Locked in for as long as you stay.</p>
                  <form action="/api/stripe/checkout" method="post" className="mt-3">
                    <input type="hidden" name="plan" value="pro" /><input type="hidden" name="offer" value="founding" />
                    <button className="btn-primary w-full" disabled={!ready}>Claim founding price</button>
                  </form>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-[#0c0e18]/60 p-4">
                  <div className="flex items-baseline gap-1"><span className="num text-3xl font-bold">£{plan.priceGbp}</span><span className="text-sm text-slate-500">/month</span></div>
                  <form action="/api/stripe/checkout" method="post" className="mt-3">
                    <input type="hidden" name="plan" value="pro" />
                    <button className="btn-primary w-full" disabled={!ready}>Subscribe</button>
                  </form>
                </div>
              )}
              <p className="text-center text-xs text-slate-500">Cancel any time. Payments by Stripe.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
