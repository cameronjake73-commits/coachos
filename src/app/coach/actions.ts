'use server';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { recomputeRisk } from '@/lib/risk-service';
import { loadDashboard } from '@/lib/dashboard-data';
import { briefAndSave } from '@/lib/analyze-service';

export async function refreshAllRisk() {
  const { supabase, coach } = await requireCoach();
  const { data: clients } = await supabase.from('clients').select('id').eq('coach_id', coach.id).in('status', ['active', 'paused']);
  await Promise.all((clients ?? []).map((c) => recomputeRisk(supabase, c.id)));
  redirect('/coach?flash=refreshed');
}

export async function generateBrief() {
  const { supabase, coach } = await requireCoach();
  const d = await loadDashboard(supabase, coach.id, coach.checkin_day);
  try {
    await briefAndSave(supabase, coach, d);
  } catch (e) {
    redirect(`/coach?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect('/coach?flash=brief');
}
