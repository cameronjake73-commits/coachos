import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { PLANS, planFromPriceId } from '@/lib/plans';

export async function POST(request: Request) {
  const stripe = getStripe();
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${(e as Error).message}` }, { status: 400 });
  }
  const admin = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription) {
    const coachId = sub.metadata?.coach_id;
    const priceId = sub.items.data[0]?.price.id;
    const plan = priceId ? planFromPriceId(priceId) : null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const ended = ['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status);
    const patch = {
      stripe_customer_id: customerId,
      stripe_subscription_id: ended ? null : sub.id,
      subscription_status: sub.status,
      ...(plan && !ended ? { plan, client_limit: PLANS[plan].clientLimit } : {}),
    };
    const q = admin.from('coaches').update(patch);
    await (coachId ? q.eq('id', coachId) : q.eq('stripe_customer_id', customerId));
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === 'subscription' && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        if (!sub.metadata?.coach_id && s.client_reference_id) sub.metadata = { ...sub.metadata, coach_id: s.client_reference_id };
        await syncSubscription(sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
  }
  return NextResponse.json({ received: true });
}
