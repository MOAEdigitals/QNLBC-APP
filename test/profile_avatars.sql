-- Test identities and avatar changes are rolled back; no notifications are sent.
begin;
do $$
declare member uuid:=gen_random_uuid(); person uuid:=gen_random_uuid(); picture text:='data:image/jpeg;base64,/9j/2Q==';
begin
  insert into auth.users(id,raw_user_meta_data) values(member,jsonb_build_object('username','avatar.test.member','display_name','Independent Avatar Test'));
  perform set_config('request.jwt.claim.sub',member::text,true);
  perform public.update_my_avatar(picture);
  assert exists(select 1 from public.profiles where id=member and avatar_url=picture and role='user'), 'Own-avatar change failed or changed role';
  assert not exists(select 1 from public.list_directory_avatars() where avatar_url=picture), 'Unlinked account appeared in directory';
  insert into public.directory_members(id,name) values(person,'Linked Avatar Test');
  update auth.users set raw_app_meta_data=jsonb_build_object('directory_member_id',person) where id=member;
  assert exists(select 1 from public.list_directory_avatars() where member_id=person and name='Linked Avatar Test' and avatar_url=picture), 'Canonical linked avatar missing';
  begin
    perform public.update_my_avatar('javascript:alert(1)');
    raise exception 'Invalid picture accepted';
  exception when raise_exception then assert sqlerrm='Choose a compressed JPEG profile picture.'; end;
  perform public.update_my_avatar(null);
  assert not exists(select 1 from public.list_directory_avatars() where member_id=person), 'Removed avatar persisted';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  begin
    perform public.update_my_avatar(picture);
    raise exception 'Unknown account accepted';
  exception when raise_exception then assert sqlerrm='An active account is required.'; end;
  assert not has_function_privilege('anon','public.update_my_avatar(text)','execute'), 'Anonymous avatar write allowed';
  assert not has_function_privilege('anon','public.list_directory_avatars()','execute'), 'Anonymous directory avatars allowed';
end $$;
rollback;
