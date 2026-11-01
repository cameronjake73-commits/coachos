import { NextResponse } from 'next/server';
import type { createClient } from '@/lib/supabase/server';

export async function exportClient(supabase: Awaited<ReturnType<typeof createClient>>, client: Record<string, unknown> & { id: string; full_name: string }) {
  const id = client.id;
  const [checkins, photos, logs, nutrition, messages, programs] = await Promise.all([
    supabase.from('checkins').select('*').eq('client_id', id).order('submitted_at'),
    supabase.from('progress_photos').select('*').eq('client_id', id).order('taken_at'),
    supabase.from('workout_logs').select('*, set_logs(*)').eq('client_id', id).order('completed_at'),
    supabase.from('nutrition_targets').select('*').eq('client_id', id).maybeSingle(),
    supabase.from('messages').select('sender, body, created_at').eq('client_id', id).order('created_at'),
    supabase.from('programs').select('name, description, is_active, created_at, workouts(name, position, workout_exercises(sets, reps, target, notes, exercises(name)))').eq('client_id', id),
  ]);
  const signed = photos.data?.length
    ? (await supabase.storage.from('progress-photos').createSignedUrls(photos.data.map((p) => p.storage_path), 7 * 86400)).data
    : [];
  const body = {
    exported_at: new Date().toISOString(),
    note: 'Photo links expire after 7 days.',
    client,
    check_ins: checkins.data,
    progress_photos: (photos.data ?? []).map((p, i) => ({ ...p, download_url: signed?.[i]?.signedUrl ?? null })),
    workout_logs: logs.data,
    nutrition_targets: nutrition.data,
    programmes: programs.data,
    messages: messages.data,
  };
  const filename = `${client.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-data-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${filename}"` },
  });
}
