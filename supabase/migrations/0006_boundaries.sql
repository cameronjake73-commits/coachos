-- 0006: Working hours, automatic out-of-hours replies and saved replies (coach boundaries).
-- Safe to run more than once.

alter table public.coaches add column if not exists hours_enabled boolean not null default false;
alter table public.coaches add column if not exists hours_days int[] not null default '{1,2,3,4,5}';   -- 0 = Sunday … 6 = Saturday
alter table public.coaches add column if not exists hours_start text not null default '09:00';          -- UK time, HH:MM
alter table public.coaches add column if not exists hours_end text not null default '18:00';
alter table public.coaches add column if not exists reply_within_hours int not null default 24;          -- promise shown to clients
alter table public.coaches add column if not exists auto_reply_enabled boolean not null default true;
alter table public.coaches add column if not exists auto_reply_text text;
alter table public.coaches add column if not exists quick_replies jsonb not null default '[]';

-- Marks the automatic out-of-hours reply so it's shown as such and never counted as the coach replying.
alter table public.messages add column if not exists is_auto boolean not null default false;

grant update (hours_enabled, hours_days, hours_start, hours_end, reply_within_hours, auto_reply_enabled, auto_reply_text, quick_replies)
  on public.coaches to authenticated;
