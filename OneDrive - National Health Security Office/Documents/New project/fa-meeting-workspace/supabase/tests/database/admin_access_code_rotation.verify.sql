begin;
set local search_path = public, extensions;

do $$
begin
  if to_regprocedure('public.admin_rotate_fa_access_code(uuid,uuid,text)') is null then
    raise exception 'Admin access-code rotation function is missing';
  end if;
  if (
    select prosecdef from pg_proc
    where oid = 'public.admin_rotate_fa_access_code(uuid,uuid,text)'::regprocedure
  ) then
    raise exception 'Access-code rotation must use service-role caller privileges';
  end if;
  if exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'admin_rotate_fa_access_code'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Untrusted role can rotate FA access codes';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'access-code-verify@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.admin_profiles (user_id, display_name, role, is_active)
values ('90000000-0000-4000-8000-000000000002', 'Code verifier', 'admin', true);

insert into public.fa_access_codes (
  id, meeting_id, group_id, code_hash, is_active, created_by
) values (
  '70000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  repeat('a', 64), true, '90000000-0000-4000-8000-000000000002'
);
insert into public.fa_sessions (
  id, meeting_id, group_id, session_hash, expires_at
) values (
  '70000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', repeat('b', 64), now() + interval '12 hours'
);

select public.admin_rotate_fa_access_code(
  '90000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  repeat('c', 64)
);

do $$
begin
  if (select is_active from public.fa_access_codes where id = '70000000-0000-4000-8000-000000000001') then
    raise exception 'Old access code remains active';
  end if;
  if (
    select count(*) from public.fa_access_codes
    where group_id = '10000000-0000-4000-8000-000000000001'
      and is_active and code_hash = repeat('c', 64)
  ) <> 1 then
    raise exception 'New access-code hash was not stored as the only active code';
  end if;
  if (select revoked_at is null from public.fa_sessions where id = '70000000-0000-4000-8000-000000000002') then
    raise exception 'Existing FA session was not revoked';
  end if;
  if (
    select count(*) from public.audit_logs
    where actor_id = '90000000-0000-4000-8000-000000000002'
      and action = 'admin_rotate_fa_access_code'
      and after_data::text not like '%' || repeat('c', 64) || '%'
  ) <> 1 then
    raise exception 'Rotation audit is missing or leaked the code hash';
  end if;

  update public.admin_profiles
  set is_active = false
  where user_id = '90000000-0000-4000-8000-000000000002';
  begin
    perform public.admin_rotate_fa_access_code(
      '90000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', repeat('d', 64)
    );
    raise exception 'Inactive Admin rotated an access code';
  exception when others then
    if sqlerrm <> 'ADMIN_FORBIDDEN' then raise; end if;
  end;
end;
$$;

select 'Admin access-code rotation verification passed' as result;
rollback;
