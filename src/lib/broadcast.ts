import type { SupabaseClient } from '@supabase/supabase-js';
import { checkinStatus } from '@/lib/coaching';
import type { Client } from '@/lib/types';

export type Audience = 'active' | 'attention' | 'missed' | 'pick';

/** Active clients tagged with the broadcast groups they belong to. Server-only. */
export async function broadcastAudience(supabase: SupabaseClient, coachId: string, checkinDay: number) {
  const [{ data: rows }, { data: last }] = await Promise.all([
    supabase.from('clients').select('*').eq('coach_id', coachId).eq('status', 'active').order('full_name'),
    supabase.from('checkins').select('client_id, submitted_at').eq('coach_id', coachId).order('submitted_at', { ascending: false }).limit(3000),
  ]);
  const lastBy = new Map<string, string>();
  for (const r of last ?? []) if (!lastBy.has(r.client_id)) lastBy.set(r.client_id, r.submitted_at);
  return ((rows ?? []) as Client[]).map((c) => {
    const missed = checkinStatus(c, lastBy.get(c.id), checkinDay).state === 'missed';
    const groups: Audience[] = ['active'];
    if (missed) groups.push('missed');
    if (missed || c.risk_level !== 'low' || c.payment_status === 'overdue') groups.push('attention');
    return { id: c.id, full_name: c.full_name, groups };
  });
}
