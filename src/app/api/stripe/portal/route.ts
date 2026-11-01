import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url), 303);
  const { data: coach } = await supabase.from('coaches').select('stripe_customer_id').eq('id', user.id).single();
  if (!coach?.stripe_customer_id) return NextResponse.redirect(new URL('/coach/billing', request.url), 303);
  const portal = await getStripe().billingPortal.sessions.create({
    customer: coach.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/coach/billing`,
  });
  return NextResponse.redirect(portal.url, 303);
}
