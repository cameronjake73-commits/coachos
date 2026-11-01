'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCoach } from '@/lib/auth';
import { after } from 'next/server';
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
  revalidatePath(`/coach/checkins/${id}`);
}

export async function sendReply(formData: FormData) {
  const { supabase, coach } = await requireCoach();
  const id = String(formData.get('checkin_id'));
  const reply = String(formData.get('reply') ?? '').trim();
  if (!reply) redirect(`/coach/checkins/${id}?error=Write a reply first`);
  const { data: ci } = await supabase.from('checkins').update({ coach_reply: reply, replied_at: new Date().toISOString(), status: 'reviewed' })
    .eq('id', id).select('client_id').single();
  if (ci) {
    await supabase.from('messages').insert({ client_id: ci.client_id, coach_id: coach.id, sender: 'coach', body: `Check-in feedback:\n\n${reply}` });
    after(() => notifyCoachReplied(ci.client_id));
  }
  const { data: next } = await supabase.from('checkins').select('id').eq('coach_id', coach.id).eq('status', 'submitted').order('submitted_at').limit(1);
  redirect(next?.[0] ? `/coach/checkins/${next[0].id}` : '/coach/checkins?done=1');
}

export async function markReviewed(formData: FormData) {
  const { supabase } = await requireCoach();
  const id = String(formData.get('checkin_id'));
  await supabase.from('checkins').update({ status: 'reviewed' }).eq('id', id);
  redirect('/coach/checkins');
}
