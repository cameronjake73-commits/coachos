/**
 * Creates (or resets) the DEMO account for sales calls.   npm run seed:demo
 * Coach: demo@coachos.app · Client: client@coachos.app · Password: DEMO_PASSWORD (default "DemoCoach2026!")
 */
import { createClient } from '@supabase/supabase-js';
import { seedDemo } from '../src/lib/demo-seed';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local)');

seedDemo(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }))
  .then((r) => console.log(`Demo ready.\n  Coach:  ${r.coachEmail} / ${r.password}\n  Client: ${r.clientEmail} / ${r.password}`))
  .catch((e) => { console.error(e); process.exit(1); });
