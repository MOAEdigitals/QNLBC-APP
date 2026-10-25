-- Requested November/December 2026 church activities. Times were not provided.
-- Run against the QNLBC database; existing matching titles/dates are preserved.
begin;

insert into public.church_activities (title, activity_date)
select requested.title, requested.activity_date
from (values
  ('IBMA Nuera conference', date '2026-11-15'),
  ('IBMA NE District fellowship', date '2026-11-22'),
  ('Kids Christmas fellowship', date '2026-12-12'),
  ('Christmas & Thanksgiving service', date '2026-12-20'),
  ('D1YF Youth revival', date '2026-12-22'),
  ('IBMA Thanksgiving fellowship', date '2026-12-27')
) as requested(title, activity_date)
where not exists (
  select 1 from public.church_activities existing
  where existing.activity_date = requested.activity_date
    and lower(btrim(existing.title)) = lower(requested.title)
);

commit;

select title, activity_date, activity_time
from public.church_activities
where activity_date in (
  date '2026-11-15', date '2026-11-22', date '2026-12-12',
  date '2026-12-20', date '2026-12-22', date '2026-12-27'
)
order by activity_date, title;
