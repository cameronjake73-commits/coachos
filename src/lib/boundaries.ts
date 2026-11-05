import type { SupabaseClient } from '@supabase/supabase-js';
import { autoReplyText, hoursFrom, isOpen, nextOpenText } from '@/lib/hours';

const QUIET_WINDOW_MS = 16 * 3600_000; // one auto-reply per evening / weekend, not one per message

/**
 * Sends the coach's automatic out-of-hours reply after a client messages, at most once per off-hours stretch:
 * not again until the coach has replied themselves or 16 hours have passed.
 * Uses the service-role client because clients can't post messages as their coach.
 */
export async function maybeAutoReply(admin: SupabaseClient, client: { id: string; coach_id: string; full_name: string }, now = new Date()) {
  try {
    const { data: coach } = await admin.from('coaches').select('*').eq('id', client.coach_id).single();
    if (!coach || coach.auto_reply_enabled === false || coach.hours_days === undefined) return false;
    const hours = hoursFrom(coach);
    if (!hours.enabled || isOpen(hours, now)) return false;
    const { data: last } = await admin.from('messages').select('*').eq('client_id', client.id).eq('sender', 'coach')
      .order('created_at', { ascending: false }).limit(1);
    const prev = last?.[0];
    if (prev?.is_auto && now.getTime() - new Date(prev.created_at).getTime() < QUIET_WINDOW_MS) return false;
    const body = autoReplyText(coach.auto_reply_text, client.full_name.split(' ')[0], nextOpenText(hours, now));
    const { error } = await admin.from('messages').insert({
      client_id: client.id, coach_id: client.coach_id, sender: 'coach', body, is_auto: true, read_at: now.toISOString(),
    });
    return !error;
  } catch (e) {
    console.error('auto-reply failed', e);
    return false;
  }
}

/** False when the coach has working hours on and it's currently outside them (used to hold back message emails). */
export async function coachAvailable(admin: SupabaseClient, coachId: string, now = new Date()) {
  const { data: coach } = await admin.from('coaches').select('*').eq('id', coachId).single();
  return !coach || isOpen(hoursFrom(coach), now);
}
