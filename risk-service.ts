import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreClientRisk } from '@/lib/risk';

/** Gathers a client's recent data, scores risk and saves it on the client row. */
export async function recomputeRisk(supabase: SupabaseClient, clientId: string) {
  const since14 = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [{ data: client }, { data: checkins }, { count: logs }, { data: lastMsg }, { data: programs }] = await Promise.all([
    supabase.from('clients').select('id, coach_id, payment_status, renewal_date, start_date, status, coaches(checkin_day)').eq('id', clientId).single(),
    supabase.from('checkins').select('submitted_at, training_adherence, nutrition_adherence, energy, stress, sleep_quality')
      .eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(4),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('completed_at', since14),
    supabase.from('messages').select('created_at').eq('client_id', clientId).eq('sender', 'client').order('created_at', { ascending: false }).limit(1),
    supabase.from('programs').select('id, workouts(id)').eq('client_id', clientId).eq('is_active', true),
  ]);
  if (!client || client.status === 'archived' || client.status === 'invited') return null;

  const planned = (programs ?? []).reduce((n, p: { workouts: { id: string }[] }) => n + (p.workouts?.length ?? 0), 0);
  const coachRel = client.coaches as unknown as { checkin_day: number } | null;
  const result = scoreClientRisk({
    checkinDay: coachRel?.checkin_day ?? 0,
    lastCheckinAt: checkins?.[0]?.submitted_at ?? null,
    recentCheckins: checkins ?? [],
    plannedWorkoutsPerWeek: Math.min(planned, 7),
    workoutsLast14Days: logs ?? 0,
    lastClientMessageAt: lastMsg?.[0]?.created_at ?? null,
    paymentStatus: client.payment_status,
    renewalDate: client.renewal_date,
    startDate: client.start_date,
  });

  await supabase.from('clients').update({
    risk_score: result.score,
    risk_level: result.level,
    risk_reasons: result.reasons,
    risk_updated_at: new Date().toISOString(),
  }).eq('id', clientId);
  return result;
}
