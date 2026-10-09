-- Atomic parent/child saves, with a replayable request receipt for lost responses.
begin;
create table if not exists public.setlist_save_receipts (
  request_id uuid primary key,
  caller_id uuid not null,
  request_payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.setlist_save_receipts enable row level security;
revoke all on public.setlist_save_receipts from anon, authenticated;

create or replace function public.save_setlist_atomic(
  request_id uuid, target_id uuid, expected_revision bigint,
  creating boolean, parent_payload jsonb, items_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  request_body jsonb := jsonb_build_object('id', target_id, 'revision', expected_revision,
    'creating', creating, 'parent', parent_payload, 'items', items_payload);
  receipt public.setlist_save_receipts;
  parent public.setlists;
  incoming public.setlists;
  child public.setlist_items;
  item jsonb;
  kept uuid[] := '{}';
  result jsonb;
begin
  if request_id is null or creating is null or jsonb_typeof(parent_payload) is distinct from 'object'
    or jsonb_typeof(items_payload) is distinct from 'array' then
    raise exception 'Invalid setlist submission';
  end if;
  if not creating and (target_id is null or expected_revision is null) then
    raise exception 'Setlist ID and revision required';
  end if;
  if actor is null or not public.has_permission(case when creating then 'add' else 'edit' end) then
    raise exception 'Setlist permission required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select * into receipt from public.setlist_save_receipts r where r.request_id = save_setlist_atomic.request_id;
  if found then
    if receipt.caller_id <> actor or receipt.request_payload <> request_body then
      raise exception 'Save request does not match original submission';
    end if;
    return receipt.result;
  end if;
  incoming := jsonb_populate_record(null::public.setlists, parent_payload);
  if creating then
    insert into public.setlists(type,title,service_date,presider,welcome_song,closing_song,theme_song,
      sunday_school_leader,sunday_school_notes,worship_leader,worship_notes,program_leader,program_notes,general_notes)
    values(incoming.type,incoming.title,incoming.service_date,incoming.presider,incoming.welcome_song,incoming.closing_song,incoming.theme_song,
      incoming.sunday_school_leader,incoming.sunday_school_notes,incoming.worship_leader,incoming.worship_notes,incoming.program_leader,incoming.program_notes,incoming.general_notes)
    returning * into parent;
  else
    select * into parent from public.setlists where id = target_id and deleted_at is null for update;
    if not found or parent.revision <> expected_revision then raise exception 'Setlist changed. Reload before editing.'; end if;
    update public.setlists set type=incoming.type,title=incoming.title,service_date=incoming.service_date,
      presider=incoming.presider,welcome_song=incoming.welcome_song,closing_song=incoming.closing_song,theme_song=incoming.theme_song,
      sunday_school_leader=incoming.sunday_school_leader,sunday_school_notes=incoming.sunday_school_notes,
      worship_leader=incoming.worship_leader,worship_notes=incoming.worship_notes,
      program_leader=incoming.program_leader,program_notes=incoming.program_notes,general_notes=incoming.general_notes
      where id=target_id returning * into parent;
  end if;
  for item in select value from jsonb_array_elements(items_payload) loop
    child := jsonb_populate_record(null::public.setlist_items, item);
    if child.section is null or child.section not in ('sunday_school','worship','program') then raise exception 'Invalid section'; end if;
    if child.id = any(kept) then raise exception 'Duplicate song entry ID'; end if;
    if child.id is not null and exists(select 1 from public.setlist_items where id=child.id) then
      if not exists(select 1 from public.setlist_items where id=child.id and setlist_id=parent.id and deleted_at is null) then
        raise exception 'Song entry belongs to another or deleted setlist';
      end if;
      update public.setlist_items set section=child.section,position=child.position,song_id=child.song_id,
        song_title=child.song_title,key_note=child.key_note,notes=child.notes,lyrics_mode=child.lyrics_mode,
        lyrics_snapshot=child.lyrics_snapshot,source_song_revision=child.source_song_revision where id=child.id;
    else
      insert into public.setlist_items(setlist_id,section,position,song_id,song_title,key_note,notes,lyrics_mode,lyrics_snapshot,source_song_revision)
      values(parent.id,child.section,child.position,child.song_id,child.song_title,child.key_note,child.notes,child.lyrics_mode,child.lyrics_snapshot,child.source_song_revision)
      returning * into child;
    end if;
    kept := array_append(kept,child.id);
  end loop;
  for child in select * from public.setlist_items where setlist_id=parent.id and deleted_at is null and not(id=any(kept)) loop
    perform public.soft_delete_record('setlist_items', child.id, child.revision);
  end loop;
  select jsonb_build_object('parent',to_jsonb(parent),'items',coalesce(jsonb_agg(to_jsonb(i) order by i.position),'[]'::jsonb))
    into result from public.setlist_items i where i.setlist_id=parent.id and i.deleted_at is null;
  insert into public.setlist_save_receipts(request_id,caller_id,request_payload,result)
    values(save_setlist_atomic.request_id,actor,request_body,result);
  return result;
end;
$$;
revoke all on function public.save_setlist_atomic(uuid,uuid,bigint,boolean,jsonb,jsonb) from public;
grant execute on function public.save_setlist_atomic(uuid,uuid,bigint,boolean,jsonb,jsonb) to authenticated;
commit;
