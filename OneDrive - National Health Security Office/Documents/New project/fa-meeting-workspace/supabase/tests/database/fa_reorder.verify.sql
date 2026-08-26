begin;
set local search_path = public, extensions;

do $$
declare
  v_result jsonb;
  v_items jsonb;
begin
  if to_regprocedure('public.fa_reorder_issues(uuid,uuid,uuid,uuid,jsonb)') is null then
    raise exception 'FA reorder function is missing';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.fa_reorder_issues(uuid,uuid,uuid,uuid,jsonb)'::regprocedure) then
    raise exception 'FA reorder must use caller privileges';
  end if;
  if exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'fa_reorder_issues'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Untrusted roles can execute FA reorder';
  end if;

  insert into public.fa_sessions (id, meeting_id, group_id, session_hash, expires_at)
  values (
    '30000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    repeat('b', 64), now() + interval '12 hours'
  );

  select jsonb_agg(jsonb_build_object(
    'id', id,
    'expectedRowVersion', row_version,
    'position', case position when 0 then 1 else 0 end,
    'topic', topic,
    'findings', findings,
    'proposal', proposal,
    'actionPlan', action_plan,
    'monitoring', evaluation,
    'stakeholderRoles', stakeholder_roles
  ) order by position)
  into v_items
  from public.issues
  where meeting_id = '00000000-0000-4000-8000-000000000001'
    and group_id = '10000000-0000-4000-8000-000000000001'
    and deleted_at is null;

  v_result := public.fa_reorder_issues(
    '30000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000020',
    v_items
  );
  if v_result->>'ok' <> 'true'
    or v_result#>>'{data,issues,0,id}' <> '20000000-0000-4000-8000-000000000002' then
    raise exception 'Atomic reorder failed: %', v_result;
  end if;

  v_result := public.fa_reorder_issues(
    '30000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000020',
    '[]'::jsonb
  );
  if v_result->>'replayed' <> 'true' then
    raise exception 'Atomic reorder is not idempotent';
  end if;

  v_result := public.fa_reorder_issues(
    '30000000-0000-4000-8000-000000000020',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000021',
    v_items
  );
  if v_result->>'code' <> 'VERSION_CONFLICT' then
    raise exception 'Stale reorder was not rejected: %', v_result;
  end if;
end;
$$;

select 'FA reorder verification passed' as result;
rollback;
