-- Email notification preferences and send-tracking (prevents duplicate emails if the cron runs twice).
alter table public.coaches add column if not exists email_digest boolean not null default true;
alter table public.coaches add column if not exists last_digest_at timestamptz;
alter table public.clients add column if not exists email_reminders boolean not null default true;
alter table public.clients add column if not exists reminder_last_sent_at timestamptz;

grant update (business_name, ai_voice_notes, checkin_day, checkin_questions, email_digest) on public.coaches to authenticated;
