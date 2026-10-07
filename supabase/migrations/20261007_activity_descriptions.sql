begin;
alter table public.church_activities add column if not exists description text;
commit;
