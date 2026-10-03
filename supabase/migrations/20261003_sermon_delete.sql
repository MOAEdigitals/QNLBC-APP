-- Run in the Supabase SQL Editor to enable sermon deletion.
begin;
grant delete on public.sermon_outlines to authenticated;
drop policy if exists sermon_delete on public.sermon_outlines;
create policy sermon_delete on public.sermon_outlines for delete to authenticated using (
  public.has_permission('delete') and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
      and (author_id = p.id or p.role = 'admin')
  )
);
commit;
