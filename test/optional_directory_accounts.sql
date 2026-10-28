-- Isolated CI only. All temporary identities and notifications roll back.
begin;
do $$
declare member uuid:=gen_random_uuid(); person uuid:=gen_random_uuid(); birthday uuid:=gen_random_uuid(); event uuid:=gen_random_uuid(); announcement uuid:=gen_random_uuid(); today date:=(now() at time zone 'Asia/Manila')::date; notice record;
begin
  insert into auth.users(id,raw_user_meta_data) values(member,jsonb_build_object('username','optional.test.member','display_name','Pastor Test'));
  assert exists(select 1 from public.profiles where id=member and directory_member_id is null and display_name='Pastor Test'), 'Independent account profile failed';
  assert not exists(select 1 from public.directory_members where name='Pastor Test'), 'Account was incorrectly added to directory';
  insert into public.directory_members(id,name) values(person,'Optional Test Leader');
  update auth.users set raw_app_meta_data=jsonb_build_object('directory_member_id',person) where id=member;
  assert exists(select 1 from public.profiles where id=member and directory_member_id=person and display_name='Optional Test Leader'), 'Canonical directory link failed';
  update auth.users set raw_app_meta_data=jsonb_build_object('directory_member_id',null),raw_user_meta_data=jsonb_build_object('username','optional.test.member','display_name','AVP Test') where id=member;
  assert exists(select 1 from public.profiles where id=member and directory_member_id is null and display_name='AVP Test'), 'Clearing link did not persist';

  perform set_config('request.jwt.claim.sub',member::text,true);
  perform public.register_push_device(gen_random_uuid(),'optional-directory-device-token-test-only');
  insert into public.birthdays(id,name,birth_date) values(birthday,'Optional Test Birthday',today);
  insert into public.church_activities(id,title,activity_date) values(event,'Optional Test Fellowship',today+1);
  perform qnlbc_private.queue_calendar_reminders((today+time '07:00') at time zone 'Asia/Manila');
  perform qnlbc_private.queue_calendar_reminders((today+time '08:00') at time zone 'Asia/Manila');
  assert exists(select 1 from public.assignment_notifications where user_id=member and birthday_id=birthday), 'Unlinked account missed birthday';
  assert exists(select 1 from public.assignment_notifications where user_id=member and activity_id=event), 'Unlinked account missed special event';

  perform set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' and active limit 1),true);
  assert exists(select 1 from public.list_announcement_recipients() where id=member), 'Unlinked account missing from custom recipients';
  perform public.send_admin_announcement(announcement,'Test title','Test body',array[member]);
  assert exists(select 1 from public.assignment_notifications where user_id=member and announcement_id=announcement), 'Unlinked account missed custom notification';
  perform set_config('request.jwt.claim.role','service_role',true);
  for notice in select * from public.claim_assignment_pushes(100) loop
    assert notice.user_id=member, 'Unexpected delivery recipient';
  end loop;
  assert (select count(*)=3 from qnlbc_private.push_deliveries d join public.assignment_notifications n on n.id=d.notification_id where n.user_id=member and d.state='leased'), 'Unlinked account notifications were cancelled instead of claimed';
  assert not exists(select 1 from public.assignment_notifications where user_id=member and kind in ('assigned','updated','practice')), 'Unexpected assignment notification';
end;
$$;
rollback;
