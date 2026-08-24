begin;
set local search_path = public, extensions;

do $$
declare
  v_result jsonb;
  v_group_version integer;
begin
  if to_regprocedure('public.fa_apply_mutation(uuid,uuid,uuid,uuid,text,uuid,integer,jsonb)') is null then
    raise exception 'FA mutation function is missing';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.fa_apply_mutation(uuid,uuid,uuid,uuid,text,uuid,integer,jsonb)'::regprocedure) then
    raise exception 'FA mutation must use caller privileges';
  end if;
  if exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'fa_apply_mutation'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Untrusted roles can execute FA mutations';
  end if;

  insert into public.fa_sessions (
    id, meeting_id, group_id, session_hash, expires_at
  ) values (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    repeat('a', 64), now() + interval '12 hours'
  );

  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0,
    '{"position":2,"topic":"ผิดกลุ่ม"}'::jsonb
  );
  if v_result->>'code' <> 'FA_SESSION_INVALID' then
    raise exception 'Cross-group mutation was not denied';
  end if;

  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0,
    '{"position":2,"topic":"ประเด็นใหม่","findings":"","proposal":"","actionPlan":"","monitoring":"","stakeholderRoles":""}'::jsonb
  );
  if v_result#>>'{data,topic}' <> 'ประเด็นใหม่' then
    raise exception 'Issue creation failed';
  end if;

  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 0, '{}'::jsonb
  );
  if v_result->>'replayed' <> 'true'
     or (select count(*) from public.issues where id = '40000000-0000-4000-8000-000000000010') <> 1 then
    raise exception 'Duplicate mutation was not idempotent';
  end if;

  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000003',
    'issue_upsert', '40000000-0000-4000-8000-000000000010', 99,
    '{"position":2,"topic":"เขียนทับ"}'::jsonb
  );
  if v_result->>'code' <> 'VERSION_CONFLICT' then
    raise exception 'Stale version was not rejected';
  end if;

  select row_version into v_group_version
  from public.meeting_groups where id = '10000000-0000-4000-8000-000000000001';
  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000004',
    'group_finalize', null, v_group_version, '{}'::jsonb
  );
  if v_result#>>'{data,status}' <> 'final' then
    raise exception 'Final mutation failed';
  end if;

  v_result := public.fa_apply_mutation(
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000005',
    'issue_delete', '40000000-0000-4000-8000-000000000010', 1, '{}'::jsonb
  );
  if v_result->>'code' <> 'GROUP_FINALIZED' then
    raise exception 'Final group accepted an FA edit';
  end if;
end;
$$;

select 'FA mutation verification passed' as result;
rollback;
