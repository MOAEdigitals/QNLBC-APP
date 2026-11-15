grant delete on public.personal_notes to authenticated;

create policy personal_notes_purge on public.personal_notes
  for delete to authenticated
  using (
    deleted_at is not null
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.active
    )
  );

create index personal_notes_deleted_idx on public.personal_notes (deleted_at)
  where deleted_at is not null;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'qnlbc-purge-expired-notes',
  '*/15 * * * *',
  $$delete from public.personal_notes where deleted_at <= now() - interval '720 hours'$$
);
