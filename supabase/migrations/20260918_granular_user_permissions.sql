-- QNLBC granular member permissions and safe vocal-upload access.
-- Run once in the Supabase SQL Editor before deploying the matching frontend.

begin;

alter table public.profiles
  add column if not exists can_add boolean not null default false,
  add column if not exists can_edit boolean not null default false,
  add column if not exists can_delete boolean not null default false,
  add column if not exists can_upload boolean not null default true;

update public.profiles
set can_add = true,
    can_edit = true,
    can_delete = true,
    can_upload = true
where role = 'admin';

create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and (
        p.role = 'admin'
        or case permission_name
          when 'add' then p.can_add
          when 'edit' then p.can_edit
          when 'delete' then p.can_delete
          when 'upload' then p.can_upload
          else false
        end
      )
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

do $$
declare
  table_name text;
  content_tables text[] := array[
    'songs', 'setlists', 'setlist_items', 'special_numbers', 'choir_entries',
    'practice_entries', 'vocal_parts', 'vocal_part_assignments', 'media',
    'attachments', 'birthdays', 'anniversaries', 'visitors', 'recognitions'
  ];
begin
  foreach table_name in array content_tables loop
    execute format('drop policy if exists permitted_members_insert on public.%I', table_name);
    execute format(
      'create policy permitted_members_insert on public.%I for insert to authenticated with check (public.has_permission(''add''))',
      table_name
    );

    execute format('drop policy if exists permitted_members_update on public.%I', table_name);
    execute format(
      'create policy permitted_members_update on public.%I for update to authenticated using (public.has_permission(''edit'')) with check (public.has_permission(''edit''))',
      table_name
    );
  end loop;
end;
$$;

-- Upload permission is deliberately narrower than Add/Edit. Members may create
-- vocal contributions and maintain only their own vocal rows and attachments.
drop policy if exists members_upload_vocal_parts_insert on public.vocal_parts;
create policy members_upload_vocal_parts_insert on public.vocal_parts
  for insert to authenticated
  with check (
    public.has_permission('upload')
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.practice_entries p
      where p.id = practice_id and p.deleted_at is null
    )
  );

drop policy if exists members_upload_vocal_parts_update on public.vocal_parts;
create policy members_upload_vocal_parts_update on public.vocal_parts
  for update to authenticated
  using (
    public.has_permission('upload')
    and created_by = (select auth.uid())
  )
  with check (
    public.has_permission('upload')
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.practice_entries p
      where p.id = practice_id and p.deleted_at is null
    )
  );

drop policy if exists members_upload_attachments_insert on public.attachments;
create policy members_upload_attachments_insert on public.attachments
  for insert to authenticated
  with check (
    public.has_permission('upload')
    and created_by = (select auth.uid())
    and (
      (
        owner_type = 'vocal_part'
        and exists (
          select 1 from public.vocal_parts vp
          where vp.id = owner_id
            and vp.created_by = (select auth.uid())
            and vp.deleted_at is null
        )
      )
      or (
        owner_type = 'practice'
        and exists (
          select 1 from public.practice_entries p
          where p.id = owner_id and p.deleted_at is null
        )
      )
    )
  );

drop policy if exists members_upload_attachments_update on public.attachments;
create policy members_upload_attachments_update on public.attachments
  for update to authenticated
  using (
    public.has_permission('upload')
    and created_by = (select auth.uid())
    and owner_type in ('vocal_part', 'practice')
  )
  with check (
    public.has_permission('upload')
    and created_by = (select auth.uid())
    and (
      (
        owner_type = 'vocal_part'
        and exists (
          select 1 from public.vocal_parts vp
          where vp.id = owner_id
            and vp.created_by = (select auth.uid())
            and vp.deleted_at is null
        )
      )
      or (
        owner_type = 'practice'
        and exists (
          select 1 from public.practice_entries p
          where p.id = owner_id and p.deleted_at is null
        )
      )
    )
  );

create or replace function public.soft_delete_record(
  target_table text,
  target_id uuid,
  expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_tables constant text[] := array[
    'songs', 'setlists', 'setlist_items', 'special_numbers', 'choir_entries',
    'practice_entries', 'vocal_parts', 'vocal_part_assignments', 'media',
    'attachments', 'birthdays', 'anniversaries', 'visitors', 'recognitions'
  ];
  affected integer;
  next_revision bigint;
begin
  if not public.has_permission('delete') then
    raise exception 'Delete permission required';
  end if;
  if not (target_table = any(allowed_tables)) then
    raise exception 'Deletion is not allowed for this table';
  end if;

  perform set_config('qnlbc.allow_deletion_change', 'on', true);
  execute format(
    'update public.%I set deleted_at = now() where id = $1 and revision = $2 and deleted_at is null returning revision',
    target_table
  ) into next_revision using target_id, expected_revision;
  get diagnostics affected = row_count;

  if affected <> 1 then
    raise exception 'Delete conflict: record changed, is already deleted, or does not exist';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.soft_delete_record(text, uuid, bigint) from public;
grant execute on function public.soft_delete_record(text, uuid, bigint) to authenticated;

commit;
