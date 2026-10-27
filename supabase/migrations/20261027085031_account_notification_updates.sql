-- These owner-only APIs never change account roles, permissions, or directory links.
create function public.update_my_avatar(new_avatar_url text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() then raise exception 'Active account required' using errcode='42501'; end if;
  if new_avatar_url is not null and (length(new_avatar_url)>200000 or new_avatar_url !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then
    raise exception 'Choose a valid profile picture';
  end if;
  update public.profiles set avatar_url=new_avatar_url where id=auth.uid();
end; $$;
revoke all on function public.update_my_avatar(text) from public,anon,authenticated;
grant execute on function public.update_my_avatar(text) to authenticated;

create function public.mark_notifications_read(notification_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() then raise exception 'Active account required' using errcode='42501'; end if;
  if coalesce(cardinality(notification_ids),0)>100 then raise exception 'Too many notifications'; end if;
  update public.assignment_notifications set read_at=coalesce(read_at,now())
    where id=any(notification_ids) and user_id=auth.uid() and dismissed_at is null;
end; $$;
revoke all on function public.mark_notifications_read(uuid[]) from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create or replace function public.set_notification_dismissed(notification_id uuid, dismissed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() or dismissed is null then raise exception 'Active account required' using errcode='42501'; end if;
  update public.assignment_notifications set dismissed_at=case when dismissed then now() else null end,
    read_at=case when dismissed then coalesce(read_at,now()) else read_at end
    where id=notification_id and user_id=auth.uid();
  if not found then raise exception 'Notification not found' using errcode='42501'; end if;
  if dismissed then
    update qnlbc_private.push_deliveries set state='cancelled'
      where push_deliveries.notification_id=set_notification_dismissed.notification_id and state in ('pending','leased');
  end if;
end; $$;
