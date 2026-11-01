'use server';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';
import { recomputeRisk } from '@/lib/risk-service';

export async function refreshAllRisk() {
  const { supabase, coach } = await requireCoach();
  const { data: clients } = await supabase.from('clients').select('id').eq('coach_id', coach.id).in('status', ['active', 'paused']);
  for (const c of clients ?? []) await recomputeRisk(supabase, c.id);
  revalidatePath('/coach');
}
