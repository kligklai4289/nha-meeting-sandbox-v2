begin;
set local search_path = public, extensions;

do $$
begin
  if to_regprocedure('public.admin_save_group_bundle(uuid,integer,jsonb,jsonb)') is null then
    raise exception 'Admin group bundle function is missing';
  end if;
  if not (
    select prosecdef
    from pg_proc
    where oid = 'public.admin_save_group_bundle(uuid,integer,jsonb,jsonb)'::regprocedure
  ) then
    raise exception 'Admin group bundle must be SECURITY DEFINER';
  end if;
  if exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'admin_save_group_bundle'
      and grantee in ('PUBLIC', 'anon')
  ) then
    raise exception 'Public or anonymous role can execute Admin group bundle';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin-bundle-verify@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.admin_profiles (user_id, display_name, role, is_active)
values ('90000000-0000-4000-8000-000000000001', 'Bundle verifier', 'admin', true);

create temporary table admin_bundle_result (payload jsonb) on commit drop;
grant insert on admin_bundle_result to authenticated;

set local request.jwt.claims = '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

insert into admin_bundle_result (payload)
select public.admin_save_group_bundle(
  '10000000-0000-4000-8000-000000000001',
  (select row_version from public.meeting_groups where id = '10000000-0000-4000-8000-000000000001'),
  jsonb_build_object(
    'name', (select name from public.meeting_groups where id = '10000000-0000-4000-8000-000000000001'),
    'scope', (select scope from public.meeting_groups where id = '10000000-0000-4000-8000-000000000001'),
    'presenter', 'ผู้ตรวจสอบระบบ',
    'status', 'review_ready'
  ),
  (
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'expectedRowVersion', row_version,
      'position', position,
      'topic', case when position = 0 then 'ทดสอบบันทึกแบบ atomic' else topic end,
      'findings', findings,
      'proposal', proposal,
      'actionPlan', action_plan,
      'monitoring', evaluation,
      'stakeholderRoles', stakeholder_roles
    ) order by position)
    from public.issues
    where group_id = '10000000-0000-4000-8000-000000000001'
      and deleted_at is null
  )
);

reset role;

do $$
declare
  v_payload jsonb := (select payload from admin_bundle_result limit 1);
begin
  if v_payload#>>'{group,presenter}' <> 'ผู้ตรวจสอบระบบ'
     or v_payload#>>'{group,status}' <> 'review_ready'
     or v_payload#>>'{issues,0,topic}' <> 'ทดสอบบันทึกแบบ atomic' then
    raise exception 'Admin bundle did not persist and return the complete group';
  end if;
  if (
    select count(*)
    from public.audit_logs
    where actor_id = '90000000-0000-4000-8000-000000000001'
      and action = 'admin_save_group_bundle'
      and group_id = '10000000-0000-4000-8000-000000000001'
  ) <> 1 then
    raise exception 'Admin bundle did not create exactly one audit record';
  end if;

  begin
    perform public.admin_save_group_bundle(
      '10000000-0000-4000-8000-000000000001',
      1,
      '{"name":"stale","scope":"","presenter":"","status":"draft"}'::jsonb,
      '[]'::jsonb
    );
    raise exception 'Stale group version was accepted';
  exception
    when others then
      if sqlerrm <> 'VERSION_CONFLICT' then
        raise;
      end if;
  end;
end;
$$;

select 'Admin group bundle verification passed' as result;
rollback;
