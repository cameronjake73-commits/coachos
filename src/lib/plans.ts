/**
 * One plan, everything included, unlimited clients.
 * A founding-member price is offered while STRIPE_PRICE_FOUNDING is set (remove it, or set FOUNDING_OFFER=off, to close the offer).
 */
export const UNLIMITED = 1000; // practical cap stored as client_limit; shown as "unlimited"

export const PLANS = {
  pro: { name: 'COACHOS', priceGbp: 199, clientLimit: UNLIMITED, envPrice: 'STRIPE_PRICE_PRO' },
} as const;

export const FOUNDING = { priceGbp: 99, spots: 10, envPrice: 'STRIPE_PRICE_FOUNDING' } as const;

export type PaidPlan = keyof typeof PLANS;
export const TRIAL_CLIENT_LIMIT = UNLIMITED;

export const foundingOpen = () => Boolean(process.env[FOUNDING.envPrice]) && process.env.FOUNDING_OFFER !== 'off';
export const stripeReady = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env[PLANS.pro.envPrice]);

/** Any of our price IDs (full or founding) maps to the single paid plan. */
export function planFromPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env[PLANS.pro.envPrice] || priceId === process.env[FOUNDING.envPrice]) return 'pro';
  return null;
}

export const isUnlimited = (limit: number) => limit >= UNLIMITED;
/** "12 clients" when unlimited, otherwise "12 of 30 client places used". */
export const placesText = (used: number, limit: number) =>
  isUnlimited(limit) ? `${used} client${used === 1 ? '' : 's'} · unlimited` : `${used} of ${limit} client places used`;

export const FEATURES = [
  'Unlimited clients',
  'Client app for workouts, check-ins and messages',
  'Retention alerts and missed check-in tracking',
  'AI check-in summaries, drafted replies and weekly priorities',
  'Programme builder and exercise library',
  'Progress photos, measurements and timelines',
  'Spreadsheet import and group messages',
  'Working hours, auto-replies and saved replies',
];
