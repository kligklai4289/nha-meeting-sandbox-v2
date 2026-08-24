begin;
set local search_path = public, extensions;
select plan(11);

select has_function(
  'public', 'fa_apply_mutation',
  array['uuid', 'uuid', 'uuid', 'uuid', 'text', 'uuid', 'integer', 'jsonb'],
  'FA mutation transaction exists'
);

select results_eq(
  $$
    select count(*)::bigint from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'fa_apply_mutation'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  $$,
  array[0::bigint],
  'public, anon, and authenticated cannot execute FA mutations directly'
);

select results_eq(
  $$
    select prosecdef from pg_proc
    where oid = 'public.fa_apply_mutation(uuid,uuid,uuid,uuid,text,uuid,integer,jsonb)'::regprocedure
  $$,
  array[false],
  'FA mutation runs with the service role caller privileges instead of SECURITY DEFINER'
);

insert into public.fa_sessions (
  id, meeting_id, group_id, session_hash, expires_at
) values (
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  repeat('a', 64), now() + interval '12 hours'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0,
    '{"position":2,"topic":"ผิดกลุ่ม"}'::jsonb
  )->>'code',
  'FA_SESSION_INVALID',
  'session cannot mutate another group'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0,
    '{"position":2,"topic":"ประเด็นใหม่","findings":"","proposal":"","actionPlan":"","monitoring":"","stakeholderRoles":""}'::jsonb
  )#>>'{data,topic}',
  'ประเด็นใหม่',
  'session creates an issue only in its group'
);

select is(
  (select count(*) from public.issues where id = '40000000-0000-4000-8000-000000000010'),
  1::bigint,
  'issue is created once'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0,
    '{}'::jsonb
  )->>'replayed',
  'true',
  'duplicate mutation replays the stored receipt'
);

select is(
  (select count(*) from public.issues where id = '40000000-0000-4000-8000-000000000010'),
  1::bigint,
  'duplicate mutation does not add another issue'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000003',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 99,
    '{"position":2,"topic":"เขียนทับ"}'::jsonb
  )->>'code',
  'VERSION_CONFLICT',
  'stale row version cannot overwrite an issue'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000004',
    'group_finalize', null,
    (select row_version from public.meeting_groups where id = '10000000-0000-4000-8000-000000000001'),
    '{}'::jsonb
  )#>>'{data,status}',
  'final',
  'FA can Final its bound group'
);

select is(
  public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000005',
    'issue_delete', '40000000-0000-4000-8000-000000000010', 1,
    '{}'::jsonb
  )->>'code',
  'GROUP_FINALIZED',
  'Final locks later FA edits'
);

select * from finish();
rollback;
