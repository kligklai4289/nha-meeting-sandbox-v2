begin;
set local search_path = public, extensions;

do $$
declare
  v_result jsonb;
  v_attempt integer;
begin
  if to_regprocedure('public.fa_claim_access_attempt(uuid,text)') is null
    or to_regprocedure('public.fa_clear_access_attempts(uuid,text)') is null then
    raise exception 'FA attempt protection functions are missing';
  end if;
  if exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in ('fa_claim_access_attempt', 'fa_clear_access_attempts')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'Untrusted role can call FA attempt protection functions';
  end if;

  for v_attempt in 1..5 loop
    v_result := public.fa_claim_access_attempt(
      '10000000-0000-4000-8000-000000000001', repeat('f', 64)
    );
    if not (v_result->>'allowed')::boolean then
      raise exception 'FA attempt % was blocked before the configured limit', v_attempt;
    end if;
  end loop;

  v_result := public.fa_claim_access_attempt(
    '10000000-0000-4000-8000-000000000001', repeat('f', 64)
  );
  if (v_result->>'allowed')::boolean or v_result->>'blockedUntil' is null then
    raise exception 'Sixth FA attempt was not blocked for the cooldown period';
  end if;

  perform public.fa_clear_access_attempts(
    '10000000-0000-4000-8000-000000000001', repeat('f', 64)
  );
  v_result := public.fa_claim_access_attempt(
    '10000000-0000-4000-8000-000000000001', repeat('f', 64)
  );
  if not (v_result->>'allowed')::boolean then
    raise exception 'Clearing successful-login attempts did not reset the limiter';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'access-protection-verify@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.admin_profiles (user_id, display_name, role, is_active)
values ('90000000-0000-4000-8000-000000000003', 'Protection verifier', 'admin', true);

select public.admin_rotate_fa_access_code(
  '90000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001', repeat('e', 64)
);

do $$
begin
  begin
    perform public.admin_rotate_fa_access_code(
      '90000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000002', repeat('e', 64)
    );
    raise exception 'Duplicate active FA code was accepted for another group';
  exception when others then
    if sqlerrm <> 'DUPLICATE_ACCESS_CODE' then raise; end if;
  end;
end;
$$;

select 'FA access protection verification passed' as result;
rollback;
