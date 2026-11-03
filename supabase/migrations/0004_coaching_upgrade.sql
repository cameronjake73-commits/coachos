-- COACHOS upgrade: richer client records, body measurements, configurable check-ins and AI caches.
-- Safe to run once on an existing database. Nothing is deleted.

-- Clients: contact, goals, archive date and cached AI output
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists target_weight_kg numeric(5,2);
alter table public.clients add column if not exists goal_deadline date;
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.clients add column if not exists ai_summary jsonb;      -- {observations[], suggestions[], summary, model, generated_at}
alter table public.clients add column if not exists ai_draft text;          -- latest AI-drafted message, waiting for the coach to edit/send
alter table public.clients add column if not exists ai_draft_at timestamptz;

-- Check-ins: extra body measurements (all optional)
alter table public.checkins add column if not exists chest_cm numeric(5,1);
alter table public.checkins add column if not exists hips_cm numeric(5,1);
alter table public.checkins add column if not exists arm_cm numeric(5,1);
alter table public.checkins add column if not exists thigh_cm numeric(5,1);
alter table public.checkins add column if not exists body_fat_pct numeric(4,1);

-- Coaches: which measurements clients are asked for, and the cached AI weekly brief
alter table public.coaches add column if not exists checkin_measurements text[] not null default '{waist}';
alter table public.coaches add column if not exists ai_brief jsonb;

grant update (business_name, ai_voice_notes, checkin_day, checkin_questions, email_digest, checkin_measurements, ai_brief)
  on public.coaches to authenticated;

-- Faster lookups used by the dashboard and missed check-in tracking
create index if not exists clients_coach_renewal_idx on public.clients (coach_id, renewal_date);
create index if not exists workout_logs_completed_idx on public.workout_logs (completed_at desc);
