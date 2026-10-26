-- Only for the isolated CI database, never the live project.
create table public.birthdays(id uuid primary key default gen_random_uuid(),name text not null,birth_date date not null,deleted_at timestamptz);
create table public.church_activities(id uuid primary key default gen_random_uuid(),title text not null,activity_date date not null,activity_time time);
insert into auth.users(id,raw_user_meta_data) values
  ('cd270000-0000-0000-0000-000000000001','{"username":"notes.test.admin"}'),
  ('cd270000-0000-0000-0000-000000000002','{"username":"notes.test.member"}');
update public.profiles set role='admin' where username='notes.test.admin';
