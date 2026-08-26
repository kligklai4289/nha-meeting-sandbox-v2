begin;
set local search_path = public, extensions;
select plan(8);

select is(
  (select count(*) from public.meetings where status = 'active'),
  1::bigint,
  'one active meeting'
);

select is(
  (
    select title
    from public.meetings
    where id = '00000000-0000-4000-8000-000000000001'
  ),
  'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
  'meeting title matches the approved round'
);

select is(
  (
    select meeting_date::text
    from public.meetings
    where id = '00000000-0000-4000-8000-000000000001'
  ),
  '2026-08-27',
  'meeting date is 27 August 2026'
);

select results_eq(
  $$
    select group_no::integer, name
    from public.meeting_groups
    where meeting_id = '00000000-0000-4000-8000-000000000001'
    order by group_no
  $$,
  $$
    values
      (1, 'บริหารกองทุน เหมาจ่าย'::text),
      (2, 'กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู'::text),
      (3, 'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)'::text)
  $$,
  'the three approved groups exist in order'
);

select is(
  (select count(*) from public.issues where deleted_at is null),
  6::bigint,
  'staging has six active sample issues'
);

select is(
  (select count(distinct group_id) from public.issues where deleted_at is null),
  3::bigint,
  'every group has sample issues'
);

select is(
  (select count(*) from public.fa_access_codes),
  0::bigint,
  'FA codes are provisioned securely after seed'
);

select is(
  (select count(*) from auth.users),
  0::bigint,
  'Admin users are invited outside SQL seed'
);

select * from finish();
rollback;
