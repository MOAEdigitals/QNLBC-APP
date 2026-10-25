-- Store project_url and notification_dispatch_secret in Supabase Vault first.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function qnlbc_private.dispatch_assignment_pushes()
returns void language plpgsql security definer set search_path='' as $$
declare project_url text; secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='notification_dispatch_secret';
  if project_url is null or secret is null then raise exception 'Notification scheduling secrets are missing'; end if;
  perform net.http_post(url:=rtrim(project_url,'/')||'/functions/v1/assignment-notifications',
    headers:=jsonb_build_object('Content-Type','application/json','x-notification-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=60000);
end; $$;
revoke all on function qnlbc_private.dispatch_assignment_pushes() from public,anon,authenticated;
-- Cron uses UTC: 01:00 Saturday = 09:00 Saturday in Asia/Manila.
select cron.schedule('qnlbc-saturday-practice','0 1 * * 6','select qnlbc_private.queue_practice_reminders();');
select cron.schedule('qnlbc-push-delivery','* * * * *','select qnlbc_private.dispatch_assignment_pushes();');
