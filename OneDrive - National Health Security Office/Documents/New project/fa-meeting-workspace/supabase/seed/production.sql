begin;

insert into public.meetings (
  id,
  title,
  fiscal_year,
  meeting_date,
  starts_at,
  ends_at,
  location,
  status,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000000001',
  'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
  2570,
  '2026-08-27',
  '09:00',
  '16:30',
  'โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา',
  'active',
  '2026-08-20 02:00:00+00',
  '2026-08-20 02:00:00+00'
)
on conflict (id) do update set
  title = excluded.title,
  fiscal_year = excluded.fiscal_year,
  meeting_date = excluded.meeting_date,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  status = excluded.status;

insert into public.meeting_groups (
  id,
  meeting_id,
  group_no,
  name,
  scope,
  presenter,
  status,
  finalized_at,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    1,
    'บริหารกองทุน เหมาจ่าย',
    'IP กับโรคค่าใช้จ่ายสูง / OP กับปฐมภูมิ หน่วยนวัตกรรม / โรคมุ่งเน้นมีผลกระทบ จิตเวช ไต สมอง หัวใจ / Audit',
    '',
    'draft',
    null,
    '2026-08-20 02:00:00+00',
    '2026-08-20 02:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    2,
    'กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู',
    'การบริหารกองทุนท้องถิ่นและการทำงานด้านส่งเสริม ป้องกัน และฟื้นฟู',
    '',
    'draft',
    null,
    '2026-08-20 02:00:00+00',
    '2026-08-20 02:00:00+00'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    3,
    'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)',
    'การคุ้มครองสิทธิและการวิเคราะห์สาเหตุเพื่อป้องกันปัญหาเกิดซ้ำ',
    '',
    'draft',
    null,
    '2026-08-20 02:00:00+00',
    '2026-08-20 02:00:00+00'
  )
on conflict (id) do update set
  meeting_id = excluded.meeting_id,
  group_no = excluded.group_no,
  name = excluded.name,
  scope = excluded.scope,
  presenter = excluded.presenter,
  status = excluded.status,
  finalized_at = excluded.finalized_at;

commit;
