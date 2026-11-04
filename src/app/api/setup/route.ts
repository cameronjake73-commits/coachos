import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { FOUNDING, PLANS } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Row = { name: string; ok: boolean | null; detail: string; fix?: string };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Setup checker for the owner: /api/setup?key=CRON_SECRET  (add &email=you@x.com to send a test email, &ai=1 to test the AI)
 * Shows which services are connected and what to fix. Never prints secret values.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get('key') !== secret) return new NextResponse('Add ?key= followed by your CRON_SECRET to this link.', { status: 401 });
  const rows: Row[] = [];
  const env = (k: string) => Boolean(process.env[k]);

  // App URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  rows.push({ name: 'Website address', ok: !!appUrl && appUrl.startsWith('https://') && !appUrl.endsWith('/') && url.origin === appUrl,
    detail: appUrl ? `NEXT_PUBLIC_APP_URL is ${appUrl}${url.origin !== appUrl ? ` but you opened ${url.origin}` : ''}` : 'NEXT_PUBLIC_APP_URL is missing',
    fix: 'Set NEXT_PUBLIC_APP_URL to your exact site address (https://…, no slash at the end), update Supabase → Authentication → URL Configuration to match, then redeploy.' });

  // Database
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('coaches').select('checkin_measurements, ai_brief').limit(1);
    const { error: e2 } = await admin.from('clients').select('target_weight_kg, ai_draft').limit(1);
    rows.push({ name: 'Database (Supabase)', ok: !error && !e2, detail: error || e2 ? (error ?? e2)!.message : 'Connected, and migrations 0001–0005 are in.',
      fix: 'Check the three Supabase keys in Vercel, and run any database files (0001–0005) you have not run yet.' });
  } catch (e) { rows.push({ name: 'Database (Supabase)', ok: false, detail: (e as Error).message, fix: 'Check the three Supabase keys in Vercel.' }); }

  // Email
  if (!env('RESEND_API_KEY')) rows.push({ name: 'Email (Resend)', ok: null, detail: 'Not connected: no emails are sent.', fix: 'Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy.' });
  else {
    const from = process.env.EMAIL_FROM || '(default sender)';
    const to = url.searchParams.get('email');
    if (to) {
      const sent = await sendEmail(to, 'COACHOS test email', '<p>If you can read this, email is working. 🎉</p>');
      rows.push({ name: 'Email (Resend)', ok: sent, detail: sent ? `Test email sent to ${to} from ${from}. Check your inbox (and spam).` : `Sending failed from ${from}.`, fix: 'In Resend, check your domain shows Verified and EMAIL_FROM uses an address on that domain.' });
    } else rows.push({ name: 'Email (Resend)', ok: true, detail: `Key added. Sender: ${from}. Add &email=you@example.com to this link to send yourself a test.` });
  }

  // AI
  if (!env('ANTHROPIC_API_KEY')) rows.push({ name: 'AI (Anthropic)', ok: null, detail: 'Not connected: AI features show "AI off".', fix: 'Add ANTHROPIC_API_KEY in Vercel, then redeploy.' });
  else if (url.searchParams.get('ai')) {
    try {
      const r = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 20, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] });
      const text = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
      rows.push({ name: 'AI (Anthropic)', ok: true, detail: `Working. The AI replied: "${text.slice(0, 40)}"` });
    } catch (e) { rows.push({ name: 'AI (Anthropic)', ok: false, detail: (e as Error).message.slice(0, 200), fix: 'Check the key is copied fully and your Anthropic account has credit (Billing → add credit).' }); }
  } else rows.push({ name: 'AI (Anthropic)', ok: true, detail: 'Key added. Add &ai=1 to this link to run a live test.' });

  // Stripe
  if (!env('STRIPE_SECRET_KEY')) rows.push({ name: 'Payments (Stripe)', ok: null, detail: 'Not connected: plan buttons are disabled.', fix: 'Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_PRO (and STRIPE_PRICE_FOUNDING) in Vercel, then redeploy.' });
  else {
    try {
      const { getStripe } = await import('@/lib/stripe');
      const stripe = getStripe();
      const mode = process.env.STRIPE_SECRET_KEY!.startsWith('sk_live') ? 'LIVE (real money)' : 'TEST mode (no real money)';
      const check = async (k: string, gbp: number) => {
        const id = process.env[k];
        if (!id) return `${k} missing`;
        const p = await stripe.prices.retrieve(id);
        const ok = p.currency === 'gbp' && p.unit_amount === gbp * 100 && p.recurring?.interval === 'month';
        return ok ? `${k} = £${gbp}/month ✓` : `${k} is ${p.currency.toUpperCase()} ${(p.unit_amount ?? 0) / 100}/${p.recurring?.interval ?? 'one-off'} (expected £${gbp}/month)`;
      };
      const pro = await check(PLANS.pro.envPrice, PLANS.pro.priceGbp);
      const founding = process.env[FOUNDING.envPrice] ? await check(FOUNDING.envPrice, FOUNDING.priceGbp) : 'Founding offer off (no STRIPE_PRICE_FOUNDING)';
      const hook = env('STRIPE_WEBHOOK_SECRET') ? 'Webhook secret added' : 'STRIPE_WEBHOOK_SECRET missing: payments will not unlock accounts';
      const ok = pro.includes('✓') && env('STRIPE_WEBHOOK_SECRET') && !founding.includes('expected');
      rows.push({ name: 'Payments (Stripe)', ok, detail: `${mode}. ${pro}. ${founding}. ${hook}.`, fix: ok ? undefined : 'Fix the item mentioned above in Stripe or Vercel, then redeploy.' });
    } catch (e) { rows.push({ name: 'Payments (Stripe)', ok: false, detail: (e as Error).message.slice(0, 200), fix: 'Check STRIPE_SECRET_KEY is the full "sk_…" key and the price IDs start with "price_".' }); }
  }

  const icon = (ok: boolean | null) => (ok === true ? '✅' : ok === false ? '❌' : '⚪');
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>COACHOS setup check</title>
<body style="margin:0;background:#0a0b13;color:#f5f6fa;font:15px/1.55 system-ui,sans-serif;padding:24px"><div style="max-width:640px;margin:0 auto">
<h1 style="font-size:22px">COACHOS setup check</h1><p style="color:#878da9">✅ working · ❌ needs fixing · ⚪ not connected yet (optional)</p>
${rows.map((r) => `<div style="background:#10121d;border:1px solid #212436;border-radius:14px;padding:16px;margin:12px 0"><div style="font-weight:600">${icon(r.ok)} ${esc(r.name)}</div><div style="color:#c5c9da;margin-top:4px">${esc(r.detail)}</div>${r.fix && r.ok !== true ? `<div style="color:#fcd34d;margin-top:6px;font-size:14px">${esc(r.fix)}</div>` : ''}</div>`).join('')}
<p style="color:#878da9;font-size:13px">Remember to press Redeploy in Vercel after changing any key.</p></div></body>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
