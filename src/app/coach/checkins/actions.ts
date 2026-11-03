'use server';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { requireCoach } from '@/lib/auth';
import { analyzeAndSave } from '@/lib/analyze-service';
import { notifyCoachReplied } from '@/lib/notify';

export async function runAiAnalysis(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('checkin_id'));
  try {
    await analyzeAndSave(supabase, coach, id);
  } catch (e) {
    redirect(`/coach/checkins/${id}?error=${encodeURIComponent(`AI analysis failed: ${(e as Error).message}`)}`);
  }
  redirect(`/coach/checkins/${id}?flash=analysed`);
}

async function nextPending(supabase: Awaited<ReturnType<typeof requireCoach>>['supabase'], coachId: string, skip: string) {
  const { data } = await supabase.from('checkins').select('id').eq('coach_id', coachId).eq('status', 'submitted').neq('id', skip).order('submitted_at').limit(1);
  return data?.[0]?.id as string | undefined;
}

export async function sendReply(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('checkin_id'));
  const reply = String(formData.get('reply') ?? '').trim().slice(0, 5000);
  if (!reply) redirect(`/coach/checkins/${id}?error=Write a reply first`);
  const { data: ci } = await supabase.from('checkins').update({ coach_reply: reply, replied_at: new Date().toISOString(), status: 'reviewed' })
    .eq('id', id).select('client_id').single();
  if (ci) {
    await supabase.from('messages').insert({ client_id: ci.client_id, coach_id: coach.id, sender: 'coach', body: `Check-in feedback:\n\n${reply}` });
    after(() => notifyCoachReplied(ci.client_id));
  }
  const next = await nextPending(supabase, coach.id, id);
  redirect(next ? `/coach/checkins/${next}?flash=sent` : '/coach/checkins?done=1');
}

export async function markReviewed(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('checkin_id'));
  await supabase.from('checkins').update({ status: 'reviewed' }).eq('id', id);
  const next = await nextPending(supabase, coach.id, id);
  redirect(next ? `/coach/checkins/${next}?flash=reviewed` : '/coach/checkins?done=1');
}
