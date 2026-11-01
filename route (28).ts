import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportClient } from '@/lib/export';

/** Clients can download their own data at any time. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: client } = await supabase.from('clients').select('*').eq('user_id', user.id).single();
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return exportClient(supabase, client);
}
