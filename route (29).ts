import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportClient } from '@/lib/export';

/** GDPR data export (right of access / portability). Coach downloads everything held about one client as JSON. RLS limits it to their own clients. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).single();
  if (!client || client.coach_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return exportClient(supabase, client);
}
