-- Run once in Supabase SQL Editor. Repeat runs skip matching active birthdays.
-- 2000 is only a date-storage placeholder; the app uses month/day annually.
begin;
lock table public.birthdays in share row exclusive mode;
with supplied(name, birth_date) as (values
('Bro. Adrian Ocampo',date '2000-01-07'),
('Sis. Lucy Acuña',date '2000-01-07'),
('Bro. DJ Pajarillo',date '2000-01-17'),
('Bro. Leony Bumanlag',date '2000-01-17'),
('Bro. EJ Mariano',date '2000-01-22'),
('Sis. Zia Mariano',date '2000-01-28'),
('Sis. Letty Bumanlag',date '2000-02-14'),
('Sis. Joy Pangilinan',date '2000-03-01'),
('Sis. Jellien Lopez',date '2000-03-07'),
('Sis. Jonabhi Sarmiento',date '2000-03-12'),
('Bro. Jose Pangilinan',date '2000-03-08'),
('Sis Gloria Pajarillo',date '2000-03-29'),
('Sis. Jayzel Mariano',date '2000-04-06'),
('Sis. Alma Pangilinan',date '2000-04-23'),
('Sis. Czarina Pajarillo',date '2000-04-25'),
('Sis. Rose Mempin',date '2000-04-28'),
('Sis. Liezel Mariano',date '2000-05-01'),
('Sis. Ara Ocampo',date '2000-05-09'),
('Sis. Luz Ocampo',date '2000-06-07'),
('Sis. Mary Joy Mag-isa',date '2000-07-05'),
('Bro. Dennis Pajarillo',date '2000-08-12'),
('Sis Mary Rose Mempin',date '2000-08-19'),
('Bro. Johnrey Pajarillo',date '2000-08-07'),
('Sis. Lanie Bumanlag',date '2000-08-21'),
('Bro. Roger Sarmiento',date '2000-09-13'),
('Bro. DM Pajarillo',date '2000-09-15'),
('Bro. JV Bantique',date '2000-09-26'),
('Sis. Marjorie Pangilinan',date '2000-10-13'),
('Bro. Dan Pangilinan',date '2000-10-20'),
('Bro. Joshua Mag-isa',date '2000-10-31'),
('Sis Fe Pajarillo',date '2000-10-27'),
('Bro Niño Pajarillo',date '2000-10-17'),
('Bro. Gyron Mesina',date '2000-11-04'),
('Sis. Ems Pelaez',date '2000-11-11'),
('Bro. Ronnie Pangilinan',date '2000-11-13'),
('Ptr. Ariel Ocampo',date '2000-11-14'),
('Sis. Joan Doronio',date '2000-12-05'),
('Sis. Faye Pelaez',date '2000-12-08'),
('Sis Lita Bobis',date '2000-12-09'),
('Bro. Marius Ocampo',date '2000-12-13'),
('Sis. Loida Delfin',date '2000-12-16'),
('Bro. Joseph Pangilinan',date '2000-12-18'),
('Sis. Niña Pangilinan',date '2000-12-28'),
('Bro. Eric Carpio',date '2000-12-28'),
('Bro. Aljoe Pangilinan',date '2000-12-31')
)
insert into public.birthdays (name, birth_date)
select s.name, s.birth_date from supplied s
where not exists (
 select 1 from public.birthdays b
 where b.deleted_at is null
 and regexp_replace(lower(btrim(b.name)), '[[:space:].]+', '', 'g') = regexp_replace(lower(btrim(s.name)), '[[:space:].]+', '', 'g')
 and to_char(b.birth_date, 'MM-DD') = to_char(s.birth_date, 'MM-DD')
)
returning name, to_char(birth_date, 'Month DD') as birthday;
commit;
