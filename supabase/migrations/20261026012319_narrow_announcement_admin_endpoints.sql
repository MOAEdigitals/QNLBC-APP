begin;
-- Public endpoints expose only these three admin-checked operations.
-- Do not grant private-schema access for callers of these wrappers.
alter function public.list_announcement_recipients() security definer;
alter function public.send_admin_announcement(uuid,text,text,uuid[]) security definer;
alter function public.list_admin_announcements() security definer;
revoke all on function qnlbc_private.list_announcement_recipients(),qnlbc_private.send_admin_announcement(uuid,text,text,uuid[]),qnlbc_private.list_admin_announcements() from public,anon,authenticated;
-- The delegated operations validate auth.uid() against active admin profiles.
-- Their definer rights do not trust user-controlled JWT metadata.
commit;
