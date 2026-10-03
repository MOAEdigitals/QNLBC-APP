-- Add choir link attachments; existing choir edit policies still apply.
begin;
alter table public.choir_entries add column if not exists media_attachments jsonb not null default '[]'::jsonb;
alter table public.choir_entries drop constraint if exists choir_media_array;
alter table public.choir_entries add constraint choir_media_array check (jsonb_typeof(media_attachments) = 'array');
commit;
