-- COACHOS schema. Run in the Supabase SQL editor (or `supabase db push`).
-- All personal and health data is protected by row-level security (RLS).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles & coaches
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('coach', 'client')),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table public.coaches (
  id uuid primary key references public.profiles(id) on delete cascade,
  business_name text,
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'growth', 'pro')),
  client_limit int not null default 10,
  subscription_status text not null default 'trialing',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  trial_ends_at timestamptz not null default now() + interval '14 days',
  ai_voice_notes text,           -- how the coach writes; used to style AI drafts
  checkin_day int not null default 0 check (checkin_day between 0 and 6), -- 0 = Sunday
  checkin_questions jsonb not null default '[]'::jsonb, -- extra custom questions: [{id, label}]
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  status text not null default 'invited' check (status in ('invited', 'active', 'paused', 'archived')),
  goal text,
  start_date date default current_date,
  monthly_fee numeric(10,2),
  renewal_date date,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'due', 'overdue', 'cancelled')),
  notes text,
  onboarding jsonb not null default '{}'::jsonb,
  health_consent_at timestamptz,          -- explicit consent (UK GDPR Art. 9) recorded at onboarding
  risk_score int not null default 0 check (risk_score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  risk_reasons jsonb not null default '[]'::jsonb,
  risk_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (coach_id, email)
);
create index on public.clients (coach_id, status);

create table public.invites (
  token text primary key default encode(gen_random_bytes(24), 'hex'),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Training
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.coaches(id) on delete cascade, -- null = global library
  name text not null,
  muscle_group text,
  equipment text,
  instructions text,
  video_url text,
  created_at timestamptz not null default now()
);
create index on public.exercises (coach_id);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade, -- null = template
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.programs (client_id);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  position int not null default 0,
  notes text
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null default 0,
  sets int not null default 3 check (sets between 1 and 20),
  reps text not null default '8-12',
  target text,          -- e.g. "RPE 8" or "60kg"
  rest_seconds int default 90,
  notes text
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  workout_name text not null,
  completed_at timestamptz not null default now(),
  session_rpe int check (session_rpe between 1 and 10),
  notes text
);
create index on public.workout_logs (client_id, completed_at desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  set_number int not null,
  reps int,
  weight_kg numeric(6,2)
);
create index on public.set_logs (workout_log_id);

-- ---------------------------------------------------------------------------
-- Check-ins, photos, nutrition, messages
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  waist_cm numeric(5,1),
  sleep_hours numeric(3,1),
  sleep_quality int check (sleep_quality between 1 and 10),
  energy int check (energy between 1 and 10),
  stress int check (stress between 1 and 10),
  hunger int check (hunger between 1 and 10),
  training_adherence int check (training_adherence between 0 and 100),
  nutrition_adherence int check (nutrition_adherence between 0 and 100),
  avg_steps int,
  wins text,
  struggles text,
  questions text,
  custom_answers jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  ai_analysis jsonb,      -- {summary, changes, concerns, investigate, draft_reply, model, generated_at}
  coach_reply text,
  replied_at timestamptz
);
create index on public.checkins (coach_id, status, submitted_at desc);
create index on public.checkins (client_id, submitted_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  checkin_id uuid references public.checkins(id) on delete set null,
  storage_path text not null,
  pose text check (pose in ('front', 'side', 'back', 'other')),
  taken_at timestamptz not null default now()
);

create table public.nutrition_targets (
  client_id uuid primary key references public.clients(id) on delete cascade,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  water_l numeric(3,1),
  habits jsonb not null default '[]'::jsonb, -- ["8k steps daily", ...]
  notes text,
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  sender text not null check (sender in ('coach', 'client')),
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.messages (client_id, created_at);

-- Audit trail of AI processing (GDPR accountability)
create table public.ai_events (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  kind text not null,
  model text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid() limit 1;
$$;

create or replace function public.my_coach_id_as_client() returns uuid
language sql stable security definer set search_path = public as $$
  select coach_id from public.clients where user_id = auth.uid() limit 1;
$$;

create or replace function public.coach_owns_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients where id = cid and coach_id = auth.uid());
$$;

create or replace function public.can_view_program(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.programs p
    where p.id = pid and (p.coach_id = auth.uid() or (p.client_id is not null and p.client_id = public.my_client_id()))
  );
$$;

-- New auth user -> profile (+ coach row). Clients sign up via invite link with role 'client'.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'coach');
begin
  if r not in ('coach', 'client') then r := 'coach'; end if;
  insert into public.profiles (id, role, full_name, email)
  values (new.id, r, new.raw_user_meta_data->>'full_name', new.email);
  if r = 'coach' then
    insert into public.coaches (id, business_name) values (new.id, new.raw_user_meta_data->>'business_name');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Enforce plan client limits
create or replace function public.enforce_client_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; cnt int;
begin
  if new.status = 'archived' then return new; end if;
  select client_limit into lim from public.coaches where id = new.coach_id;
  select count(*) into cnt from public.clients
    where coach_id = new.coach_id and status <> 'archived' and id <> new.id;
  if cnt >= lim then
    raise exception 'CLIENT_LIMIT_REACHED: your plan allows % active clients', lim;
  end if;
  return new;
end $$;

create trigger clients_limit before insert or update of status on public.clients
for each row execute function public.enforce_client_limit();

-- Clients can update only their own onboarding answers + consent
create or replace function public.client_complete_onboarding(answers jsonb, consent boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not consent then raise exception 'Health data consent is required'; end if;
  update public.clients
     set onboarding = answers, health_consent_at = now(), status = 'active'
   where user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.coaches enable row level security;
alter table public.clients enable row level security;
alter table public.invites enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.checkins enable row level security;
alter table public.progress_photos enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.messages enable row level security;
alter table public.ai_events enable row level security;

-- profiles
create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy "coach reads client profiles" on public.profiles for select
  using (exists (select 1 from public.clients c where c.user_id = profiles.id and c.coach_id = auth.uid()));

-- coaches (billing fields are only changed by the service role via Stripe webhook)
create policy "coach reads self" on public.coaches for select using (id = auth.uid());
create policy "client reads own coach" on public.coaches for select using (id = public.my_coach_id_as_client());
create policy "coach updates settings" on public.coaches for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.coaches from authenticated;
grant update (business_name, ai_voice_notes, checkin_day, checkin_questions) on public.coaches to authenticated;

-- clients
create policy "coach manages clients" on public.clients for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy "client reads self" on public.clients for select using (user_id = auth.uid());

-- invites: service role only (no policies => no access for anon/authenticated) except coach read
create policy "coach reads invites" on public.invites for select using (coach_id = auth.uid());
create policy "coach creates invites" on public.invites for insert with check (coach_id = auth.uid() and public.coach_owns_client(client_id));

-- exercises
create policy "read library" on public.exercises for select
  using (coach_id is null or coach_id = auth.uid() or coach_id = public.my_coach_id_as_client());
create policy "coach manages own exercises" on public.exercises for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- programs / workouts / workout_exercises
create policy "coach manages programs" on public.programs for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid() and (client_id is null or public.coach_owns_client(client_id)));
create policy "client reads own programs" on public.programs for select
  using (client_id is not null and client_id = public.my_client_id());

create policy "read workouts" on public.workouts for select using (public.can_view_program(program_id));
create policy "coach writes workouts" on public.workouts for all
  using (exists (select 1 from public.programs p where p.id = program_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.coach_id = auth.uid()));

create policy "read workout exercises" on public.workout_exercises for select
  using (exists (select 1 from public.workouts w where w.id = workout_id and public.can_view_program(w.program_id)));
create policy "coach writes workout exercises" on public.workout_exercises for all
  using (exists (select 1 from public.workouts w join public.programs p on p.id = w.program_id where w.id = workout_id and p.coach_id = auth.uid()))
  with check (exists (select 1 from public.workouts w join public.programs p on p.id = w.program_id where w.id = workout_id and p.coach_id = auth.uid()));

-- workout logs
create policy "client manages own logs" on public.workout_logs for all
  using (client_id = public.my_client_id()) with check (client_id = public.my_client_id());
create policy "coach reads client logs" on public.workout_logs for select using (public.coach_owns_client(client_id));

create policy "client manages own set logs" on public.set_logs for all
  using (exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.client_id = public.my_client_id()))
  with check (exists (select 1 from public.workout_logs l where l.id = workout_log_id and l.client_id = public.my_client_id()));
create policy "coach reads set logs" on public.set_logs for select
  using (exists (select 1 from public.workout_logs l where l.id = workout_log_id and public.coach_owns_client(l.client_id)));

-- check-ins
create policy "client submits checkins" on public.checkins for insert
  with check (client_id = public.my_client_id() and coach_id = public.my_coach_id_as_client() and status = 'submitted' and coach_reply is null and ai_analysis is null);
create policy "client reads own checkins" on public.checkins for select using (client_id = public.my_client_id());
create policy "coach reads checkins" on public.checkins for select using (coach_id = auth.uid());
create policy "coach updates checkins" on public.checkins for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- photos
create policy "client manages own photos" on public.progress_photos for all
  using (client_id = public.my_client_id()) with check (client_id = public.my_client_id());
create policy "coach reads photos" on public.progress_photos for select using (public.coach_owns_client(client_id));

-- nutrition
create policy "coach manages nutrition" on public.nutrition_targets for all
  using (public.coach_owns_client(client_id)) with check (public.coach_owns_client(client_id));
create policy "client reads nutrition" on public.nutrition_targets for select using (client_id = public.my_client_id());

-- messages
create policy "coach reads messages" on public.messages for select using (coach_id = auth.uid());
create policy "coach sends messages" on public.messages for insert
  with check (coach_id = auth.uid() and sender = 'coach' and public.coach_owns_client(client_id));
create policy "coach marks read" on public.messages for update using (coach_id = auth.uid());
create policy "client reads messages" on public.messages for select using (client_id = public.my_client_id());
create policy "client sends messages" on public.messages for insert
  with check (client_id = public.my_client_id() and coach_id = public.my_coach_id_as_client() and sender = 'client');
create policy "client marks read" on public.messages for update using (client_id = public.my_client_id());

-- ai events
create policy "coach reads ai events" on public.ai_events for select using (coach_id = auth.uid());
create policy "coach logs ai events" on public.ai_events for insert with check (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for progress photos. Path = {client_id}/{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "client uploads own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = public.my_client_id()::text);
create policy "client reads own photos" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = public.my_client_id()::text);
create policy "coach reads client photos" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and public.coach_owns_client(((storage.foldername(name))[1])::uuid));
create policy "client deletes own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = public.my_client_id()::text);
