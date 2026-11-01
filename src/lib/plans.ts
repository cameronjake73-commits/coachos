export const PLANS = {
  starter: { name: 'Starter', priceGbp: 29, clientLimit: 10, envPrice: 'STRIPE_PRICE_STARTER' },
  growth: { name: 'Growth', priceGbp: 49, clientLimit: 30, envPrice: 'STRIPE_PRICE_GROWTH' },
  pro: { name: 'Pro', priceGbp: 79, clientLimit: 75, envPrice: 'STRIPE_PRICE_PRO' },
} as const;

export type PaidPlan = keyof typeof PLANS;
export const TRIAL_CLIENT_LIMIT = 10;

export function planFromPriceId(priceId: string): PaidPlan | null {
  for (const [key, p] of Object.entries(PLANS)) {
    if (process.env[p.envPrice] === priceId) return key as PaidPlan;
  }
  return null;
}
