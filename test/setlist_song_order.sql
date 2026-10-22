-- Run in the Supabase SQL editor. All fixture rows, receipts and updates roll back.
begin;
do $test$
declare
  actor uuid; linked_song uuid; original jsonb; saved jsonb; payload jsonb;
  replay_id uuid := gen_random_uuid(); result_again jsonb; entry jsonb; matching jsonb;
  removed_ss uuid; removed_program uuid; rejected boolean;
begin
  select id into actor from public.profiles where active and role='admin' limit 1;
  if actor is null then raise exception 'An active admin is required for this rollback-only test'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  select id into linked_song from public.songs where deleted_at is null limit 1;
  select jsonb_agg(jsonb_build_object('section',section,'position',position,
    'song_title',section || ' test ' || position,'song_id',linked_song,
    'notes','Preserve notes','key_note','G','lyrics_mode','snapshot',
    'lyrics_snapshot','Preserve these lyrics','source_song_revision',1)) into payload
    from (values ('sunday_school'),('worship'),('program')) sections(section)
    cross join generate_series(0,2) position;
  original := public.save_setlist_atomic(gen_random_uuid(),null,null,true,
    '{"type":"sunday","service_date":"2099-01-04","presider":"Test presider","sunday_school_leader":"Test SS leader","worship_leader":"Test WS leader","program_leader":"Test program leader"}'::jsonb,payload);

  -- Reverse all three song leader sections in one save, keeping each row's identity.
  select jsonb_agg(item || jsonb_build_object('position',2-(item->>'position')::integer))
    into payload from jsonb_array_elements(original->'items') item;
  saved := public.save_setlist_atomic(replay_id,(original->'parent'->>'id')::uuid,
    (original->'parent'->>'revision')::bigint,false,original->'parent',payload);
  if jsonb_array_length(saved->'items')<>9 then raise exception 'Songs were lost'; end if;
  for entry in select value from jsonb_array_elements(original->'items') loop
    select value into matching from jsonb_array_elements(saved->'items') where value->>'id'=entry->>'id';
    if matching is null or (matching->>'position')::integer<>2-(entry->>'position')::integer
      or (matching - array['position','revision','updated_at','updated_by']) is distinct from
         (entry - array['position','revision','updated_at','updated_by']) then
      raise exception 'Song identity, linked data, lyrics or metadata changed during a swap';
    end if;
  end loop;
  result_again := public.save_setlist_atomic(replay_id,(original->'parent'->>'id')::uuid,
    (original->'parent'->>'revision')::bigint,false,original->'parent',payload);
  if result_again<>saved then raise exception 'Retry receipt is not idempotent'; end if;
  rejected := false;
  begin
    perform public.save_setlist_atomic(gen_random_uuid(),(original->'parent'->>'id')::uuid,
      (original->'parent'->>'revision')::bigint,false,original->'parent',payload);
  exception when others then
    if sqlerrm='Setlist changed. Reload before editing.' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'Stale revision was accepted'; end if;

  -- Simulate a legacy soft-deleted slot, then reuse it and remove another song.
  select (value->>'id')::uuid into removed_program from jsonb_array_elements(saved->'items')
    where value->>'section'='program' and (value->>'position')::integer=1;
  select (value->>'id')::uuid into removed_ss from jsonb_array_elements(saved->'items')
    where value->>'section'='sunday_school' and (value->>'position')::integer=1;
  perform public.soft_delete_record('setlist_items',removed_program,
    (select revision from public.setlist_items where id=removed_program));
  select jsonb_agg(item || jsonb_build_object('position',case when item->>'section'='sunday_school'
    then (item->>'position')::integer/2 else (item->>'position')::integer end)) into payload
    from jsonb_array_elements(saved->'items') item
    where (item->>'id')::uuid not in (removed_ss,removed_program);
  payload := payload || jsonb_build_array(jsonb_build_object('section','program','position',1,
    'song_title','New replacement song','lyrics_mode','live'));
  saved := public.save_setlist_atomic(gen_random_uuid(),(saved->'parent'->>'id')::uuid,
    (saved->'parent'->>'revision')::bigint,false,saved->'parent',payload);
  if jsonb_array_length(saved->'items')<>8
    or exists(select 1 from public.setlist_items where id in (removed_ss,removed_program) and deleted_at is null)
    or not exists(select 1 from jsonb_array_elements(saved->'items') item
      where item->>'song_title'='New replacement song' and (item->>'position')::integer=1)
    then raise exception 'Add/remove or soft-deleted slot reuse failed'; end if;

  -- An invalid final order must roll back every temporary position and parent change.
  select jsonb_agg(item || jsonb_build_object('position',0)) into payload from jsonb_array_elements(saved->'items') item;
  rejected:=false;
  begin
    perform public.save_setlist_atomic(gen_random_uuid(),(saved->'parent'->>'id')::uuid,
      (saved->'parent'->>'revision')::bigint,false,saved->'parent',payload);
  exception when unique_violation then rejected:=true;
  end;
  if not rejected or (select revision from public.setlists where id=(saved->'parent'->>'id')::uuid)<>(saved->'parent'->>'revision')::bigint
    or exists(select 1 from public.setlist_items where setlist_id=(saved->'parent'->>'id')::uuid and deleted_at is null and position>2)
    then raise exception 'Failed save was not fully rolled back'; end if;
  reset role;
end;
$test$;
rollback;
select 'PASS: swaps in all sections, metadata, retries, stale conflicts, add/remove, reused slots and rollback' as verification;
