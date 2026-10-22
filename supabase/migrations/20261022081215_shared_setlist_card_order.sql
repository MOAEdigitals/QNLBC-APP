begin;

alter table public.setlists add column if not exists display_order integer check (display_order >= 0);

-- Keep existing RLS and edit permissions; reorder only an entire, unchanged date group.
create or replace function public.reorder_setlist_cards(
  p_service_date date, p_ordered_ids uuid[], p_expected_revisions jsonb
) returns table(id uuid, display_order integer, revision bigint, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  active_count integer;
begin
  if auth.uid() is null or not public.has_permission('edit') then
    raise exception 'Setlist edit permission required';
  end if;
  if p_service_date is null or p_ordered_ids is null or cardinality(p_ordered_ids) < 2
    or array_position(p_ordered_ids, null) is not null
    or jsonb_typeof(p_expected_revisions) is distinct from 'object'
    or (select count(distinct value) from unnest(p_ordered_ids) value) <> cardinality(p_ordered_ids) then
    raise exception 'Invalid setlist order';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('setlist-order:' || p_service_date::text, 0));
  perform s.id from public.setlists s
    where s.service_date = p_service_date and s.deleted_at is null order by s.id for update;
  select count(*) into active_count from public.setlists s
    where s.service_date = p_service_date and s.deleted_at is null;
  if active_count <> cardinality(p_ordered_ids) or exists (
    select 1 from public.setlists s where s.service_date = p_service_date and s.deleted_at is null
      and (not (s.id = any(p_ordered_ids))
        or p_expected_revisions ->> s.id::text is distinct from s.revision::text)
  ) then
    raise exception 'Setlists changed. Reload before reordering.';
  end if;

  update public.setlists s set display_order = (ordered.position - 1)::integer
    from unnest(p_ordered_ids) with ordinality as ordered(setlist_id, position)
    where s.id = ordered.setlist_id and s.service_date = p_service_date and s.deleted_at is null;
  return query select s.id, s.display_order, s.revision, s.updated_at
    from public.setlists s where s.id = any(p_ordered_ids) and s.deleted_at is null
    order by s.display_order;
end;
$$;

revoke all on function public.reorder_setlist_cards(date, uuid[], jsonb) from public;
grant execute on function public.reorder_setlist_cards(date, uuid[], jsonb) to authenticated;

commit;
