import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { PLANS, type PaidPlan } from '@/lib/plans';

export async function POST(request: Request) {
  const form = await request.formData();
  const plan = String(form.get('plan')) as PaidPlan;
  const back = (msg: string) => NextResponse.redirect(new URL(`/coach/billing?error=${encodeURIComponent(msg)}`, request.url), 303);
  if (!(plan in PLANS)) return back('Unknown plan');
  const priceId = process.env[PLANS[plan].envPrice];
  if (!priceId || !process.env.STRIPE_SECRET_KEY) return back('Payments are not connected yet.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303);
  const { data: coach } = await supabase.from('coaches').select('id, stripe_customer_id, stripe_subscription_id').eq('id', user.id).single();
  if (!coach) return NextResponse.json({ error: 'Coaches only' }, { status: 403 });

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  try {

  // Existing subscribers change plan in the Billing Portal instead of creating a second subscription.
  if (coach.stripe_subscription_id && coach.stripe_customer_id) {
    const portal = await stripe.billingPortal.sessions.create({ customer: coach.stripe_customer_id, return_url: `${appUrl}/coach/billing` });
    return NextResponse.redirect(portal.url, 303);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: coach.stripe_customer_id ?? undefined,
    customer_email: coach.stripe_customer_id ? undefined : user.email,
    client_reference_id: coach.id,
    subscription_data: { metadata: { coach_id: coach.id } },
    metadata: { coach_id: coach.id },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    success_url: `${appUrl}/coach/billing?success=1`,
    cancel_url: `${appUrl}/coach/billing`,
  });
  return NextResponse.redirect(session.url!, 303);
  } catch (e) {
    console.error('stripe checkout failed', e);
    return back('Could not open checkout. Please try again.');
  }
}
