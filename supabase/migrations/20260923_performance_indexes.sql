-- Query indexes for the QNLBC read paths used by the web app.
-- Partial indexes exclude soft-deleted rows because normal screens never load them.

begin;

create index if not exists songs_active_title_idx
  on public.songs (title)
  where deleted_at is null;

create index if not exists songs_active_updated_at_idx
  on public.songs (updated_at desc)
  where deleted_at is null;

create index if not exists setlists_active_service_date_idx
  on public.setlists (service_date desc)
  where deleted_at is null;

create index if not exists setlist_items_active_parent_position_idx
  on public.setlist_items (setlist_id, position)
  where deleted_at is null;

create index if not exists special_numbers_active_date_idx
  on public.special_numbers (scheduled_date desc)
  where deleted_at is null;

create index if not exists choir_entries_active_date_idx
  on public.choir_entries (service_date desc)
  where deleted_at is null;

create index if not exists practice_entries_active_date_idx
  on public.practice_entries (practice_date desc)
  where deleted_at is null;

create index if not exists vocal_parts_active_practice_position_idx
  on public.vocal_parts (practice_id, position)
  where deleted_at is null;

create index if not exists attachments_active_owner_position_idx
  on public.attachments (owner_type, owner_id, position)
  where deleted_at is null;

commit;
