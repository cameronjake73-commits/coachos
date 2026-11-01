import { createAdminClient } from '@/lib/supabase/server';
import { analyzeAndSave } from '@/lib/analyze-service';
import { recomputeRisk } from '@/lib/risk-service';
import type { Coach } from '@/lib/types';

/** Runs after a client submits a check-in: refresh risk, then pre-generate the AI analysis so it's ready for the coach. */
export async function afterCheckinSubmitted(checkinId: string, clientId: string, coachId: string) {
  const admin = createAdminClient();
  await recomputeRisk(admin, clientId);
  if (!process.env.ANTHROPIC_API_KEY) return;
  const { data: coach } = await admin.from('coaches').select('*').eq('id', coachId).single();
  if (!coach) return;
  try {
    await analyzeAndSave(admin, coach as Coach, checkinId);
  } catch (e) {
    console.error('auto-analyze failed', e);
  }
}
