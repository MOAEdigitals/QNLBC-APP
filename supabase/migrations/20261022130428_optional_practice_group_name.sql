-- Preserve existing group names while allowing an explicitly empty optional name.
begin;
alter table public.practice_entries drop constraint if exists practice_entries_group_name_check;
alter table public.practice_entries add constraint practice_entries_group_name_check
  check (group_name = '' or length(btrim(group_name)) > 0);
commit;
