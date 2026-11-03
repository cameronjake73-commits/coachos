-- One plan with unlimited clients (stored as a practical cap of 1000).
-- Safe to run once. Raises the limit for trial and existing paid coaches; nothing is deleted.
alter table public.coaches alter column client_limit set default 1000;
update public.coaches set client_limit = 1000 where client_limit < 1000;
