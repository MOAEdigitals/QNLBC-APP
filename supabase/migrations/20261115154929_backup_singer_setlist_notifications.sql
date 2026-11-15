begin;

create table qnlbc_private.backup_singer_notification_recipients (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
revoke all on qnlbc_private.backup_singer_notification_recipients from public, anon, authenticated;

do $$
declare
  singer text;
  matches uuid[];
  constraint_name text;
  old_rule text;
begin
  foreach singer in array array['sis joy', 'sis mero'] loop
    select array_agg(id) into matches from public.profiles
    where active and lower(btrim(display_name)) = singer;
    if coalesce(cardinality(matches), 0) <> 1 then
      raise exception 'Expected one active account for %', singer;
    end if;
    insert into qnlbc_private.backup_singer_notification_recipients values (matches[1]);
  end loop;

  foreach constraint_name in array array['assignment_notifications_kind_check', 'notification_target_check'] loop
    select pg_get_expr(conbin, conrelid) into strict old_rule from pg_constraint
    where conrelid = 'public.assignment_notifications'::regclass and conname = constraint_name;
    execute format('alter table public.assignment_notifications drop constraint %I', constraint_name);
    execute format(
      'alter table public.assignment_notifications add constraint %I check ((%s) or (kind = %L and setlist_id is not null and service_date is not null and slot is null and announcement_id is null and birthday_id is null and activity_id is null and anniversary_id is null and recognition_id is null))',
      constraint_name, old_rule, 'backup_setlist'
    );
  end loop;
end;
$$;

create function qnlbc_private.notify_backup_singers_of_setlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null or new.service_date < (now() at time zone 'Asia/Manila')::date then
    return new;
  end if;

  with created as (
    insert into public.assignment_notifications (user_id, setlist_id, kind, service_date, title, body, event_key)
    select p.id, new.id, 'backup_setlist', new.service_date, 'Setlist ready for practice',
      to_char(new.service_date, 'FMMonth FMDD, YYYY') || ' — You can listen and practice now.',
      'backup_setlist:' || new.id::text
    from qnlbc_private.backup_singer_notification_recipients r
    join public.profiles p on p.id = r.user_id and p.active
    on conflict (user_id, event_key) do nothing
    returning id, user_id
  )
  insert into qnlbc_private.push_deliveries (notification_id, device_id)
  select c.id, d.id from created c join public.push_devices d on d.user_id = c.user_id
  on conflict do nothing;

  return new;
end;
$$;
revoke all on function qnlbc_private.notify_backup_singers_of_setlist() from public, anon, authenticated;

create trigger notify_backup_singers_of_setlist
after insert on public.setlists
for each row execute function qnlbc_private.notify_backup_singers_of_setlist();

commit;
