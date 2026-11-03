import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { seedDemo } from '@/lib/demo-seed';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const page = (title: string, body: string, ok = true) => new NextResponse(
  `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="margin:0;background:#0a0b13;color:#f5f6fa;font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px">
<div style="max-width:440px;background:#10121d;border:1px solid #212436;border-radius:16px;padding:28px">
<h1 style="margin:0 0 8px;font-size:22px;color:${ok ? '#4ade80' : '#ff8080'}">${title}</h1>${body}</div></body>`,
  { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

/**
 * Creates or resets the demo coach + clients. Protected by CRON_SECRET:
 *   /api/demo/seed?key=YOUR_CRON_SECRET            (optional &password=YourDemoPassword)
 * Only ever touches the two demo accounts. Real coaches and clients are never changed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get('key') !== secret) {
    return page('Not allowed', '<p>Add <code>?key=</code> followed by your CRON_SECRET from Vercel to the end of this link.</p>', false);
  }
  const password = url.searchParams.get('password') || undefined;
  if (password && password.length < 8) return page('Password too short', '<p>Use at least 8 characters.</p>', false);
  try {
    const r = await seedDemo(createAdminClient(), { password });
    return page('Demo data loaded', `<p>${r.clients} demo clients are ready, with check-ins, workouts and messages.</p>
<p style="margin-top:16px"><b>Coach login</b><br>${r.coachEmail}<br>${r.password}</p>
<p><b>Client app login</b><br>${r.clientEmail}<br>${r.password}</p>
<p style="color:#878da9;font-size:13px">Visit this link again any time to reset the demo with fresh dates.</p>
<p><a href="/login" style="color:#a28cff">Go to login →</a></p>`);
  } catch (e) {
    console.error('demo seed failed', e);
    return page('Something went wrong', `<p>${String((e as Error).message).replace(/</g, '&lt;')}</p><p style="color:#878da9;font-size:13px">Check that migrations 0001–0005 have all been run in Supabase.</p>`, false);
  }
}
