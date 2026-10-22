-- Preserve the existing RPC, receipts, permissions and child IDs while freeing final positions.
begin;
do $migration$
declare
  definition text := pg_get_functiondef('public.save_setlist_atomic(uuid,uuid,bigint,boolean,jsonb,jsonb)'::regprocedure);
  anchor text := 'for item in select value from jsonb_array_elements(items_payload) loop';
  staging text := $stage$
  -- Reserve vacant positions before assigning the final order. Positive temporary positions
  -- satisfy the existing check/unique constraints; tombstones must not occupy reused slots.
  with position_floor as (
    select greatest(
      coalesce((select max(i.position)::bigint from public.setlist_items i where i.setlist_id=parent.id), -1),
      coalesce((select max((entry->>'position')::bigint) from jsonb_array_elements(items_payload) entry), -1)
    ) as base
  ), parked as (
    select i.id, f.base + row_number() over (order by i.id) as temporary_position
    from public.setlist_items i cross join position_floor f
    where i.setlist_id=parent.id and (i.deleted_at is null or exists (
      select 1 from jsonb_array_elements(items_payload) entry
      where entry->>'section'=i.section and (entry->>'position')::integer=i.position
    ))
  )
  update public.setlist_items i set position=p.temporary_position::integer
    from parked p where i.id=p.id and i.setlist_id=parent.id;
$stage$;
begin
  if strpos(definition, '-- Reserve vacant positions before assigning the final order.') > 0 then
    return;
  end if;
  if strpos(definition, anchor) = 0 then
    raise exception 'Unexpected setlist save function: position staging was not applied';
  end if;
  -- CREATE OR REPLACE keeps the current owner and execution grants unchanged.
  execute replace(definition, anchor, staging || anchor);
end;
$migration$;
commit;
