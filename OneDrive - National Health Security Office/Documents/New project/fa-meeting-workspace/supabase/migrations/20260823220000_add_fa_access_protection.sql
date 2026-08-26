create table public.fa_access_attempts (
  group_id uuid not null references public.meeting_groups(id) on delete cascade,
  ip_hash text not null check (length(ip_hash) = 64 and ip_hash ~ '^[0-9a-f]+$'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (group_id, ip_hash)
);

alter table public.fa_access_attempts enable row level security;
revoke all on public.fa_access_attempts from public, anon, authenticated;
grant all on public.fa_access_attempts to service_role;

create unique index fa_access_codes_active_code_per_meeting
on public.fa_access_codes (meeting_id, code_hash)
where is_active;

create function public.fa_claim_access_attempt(p_group_id uuid, p_ip_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_attempt public.fa_access_attempts%rowtype;
begin
  if length(p_ip_hash) <> 64 or p_ip_hash !~ '^[0-9a-f]+$' then
    raise exception 'INVALID_IP_HASH';
  end if;
  if not exists (select 1 from public.meeting_groups where id = p_group_id) then
    return jsonb_build_object('allowed', false, 'blockedUntil', null);
  end if;

  insert into public.fa_access_attempts (group_id, ip_hash)
  values (p_group_id, p_ip_hash)
  on conflict (group_id, ip_hash) do nothing;

  select * into v_attempt
  from public.fa_access_attempts
  where group_id = p_group_id and ip_hash = p_ip_hash
  for update;

  if v_attempt.blocked_until is not null and v_attempt.blocked_until > v_now then
    return jsonb_build_object('allowed', false, 'blockedUntil', v_attempt.blocked_until);
  end if;

  if v_attempt.window_started_at <= v_now - interval '15 minutes' then
    update public.fa_access_attempts
    set attempt_count = 1, window_started_at = v_now, blocked_until = null, updated_at = v_now
    where group_id = p_group_id and ip_hash = p_ip_hash;
    return jsonb_build_object('allowed', true, 'blockedUntil', null);
  end if;

  if v_attempt.attempt_count >= 5 then
    update public.fa_access_attempts
    set blocked_until = v_now + interval '15 minutes', updated_at = v_now
    where group_id = p_group_id and ip_hash = p_ip_hash;
    return jsonb_build_object('allowed', false, 'blockedUntil', v_now + interval '15 minutes');
  end if;

  update public.fa_access_attempts
  set attempt_count = attempt_count + 1, blocked_until = null, updated_at = v_now
  where group_id = p_group_id and ip_hash = p_ip_hash;
  return jsonb_build_object('allowed', true, 'blockedUntil', null);
end;
$$;

create function public.fa_clear_access_attempts(p_group_id uuid, p_ip_hash text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.fa_access_attempts
  where group_id = p_group_id and ip_hash = p_ip_hash;
$$;

revoke all on function public.fa_claim_access_attempt(uuid, text) from public, anon, authenticated;
revoke all on function public.fa_clear_access_attempts(uuid, text) from public, anon, authenticated;
grant execute on function public.fa_claim_access_attempt(uuid, text) to service_role;
grant execute on function public.fa_clear_access_attempts(uuid, text) to service_role;

create or replace function public.admin_rotate_fa_access_code(
  p_actor_id uuid,
  p_group_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group public.meeting_groups%rowtype;
  v_rotated_at timestamptz := now();
  v_revoked_sessions integer;
begin
  if length(p_code_hash) <> 64 or p_code_hash !~ '^[0-9a-f]+$' then
    raise exception 'INVALID_CODE_HASH';
  end if;
  if not exists (
    select 1 from public.admin_profiles
    where user_id = p_actor_id and role = 'admin' and is_active = true
  ) then
    raise exception 'ADMIN_FORBIDDEN';
  end if;

  select * into v_group from public.meeting_groups where id = p_group_id for update;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;

  if exists (
    select 1 from public.fa_access_codes
    where meeting_id = v_group.meeting_id and group_id <> p_group_id
      and code_hash = p_code_hash and is_active = true
  ) then
    raise exception 'DUPLICATE_ACCESS_CODE';
  end if;

  update public.fa_access_codes
  set is_active = false, updated_at = v_rotated_at
  where meeting_id = v_group.meeting_id and group_id = p_group_id and is_active = true;

  begin
    insert into public.fa_access_codes (meeting_id, group_id, code_hash, is_active, created_by, rotated_at)
    values (v_group.meeting_id, p_group_id, p_code_hash, true, p_actor_id, v_rotated_at);
  exception when unique_violation then
    raise exception 'DUPLICATE_ACCESS_CODE';
  end;

  update public.fa_sessions
  set revoked_at = v_rotated_at, updated_at = v_rotated_at
  where meeting_id = v_group.meeting_id and group_id = p_group_id
    and revoked_at is null and expires_at > v_rotated_at;
  get diagnostics v_revoked_sessions = row_count;

  delete from public.fa_access_attempts where group_id = p_group_id;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id, meeting_id, group_id, after_data
  ) values (
    'admin', p_actor_id, 'admin_rotate_fa_access_code', 'fa_access_codes', null,
    v_group.meeting_id, p_group_id,
    jsonb_build_object('rotatedAt', v_rotated_at, 'revokedSessions', v_revoked_sessions)
  );

  return jsonb_build_object('rotatedAt', v_rotated_at, 'revokedSessions', v_revoked_sessions);
end;
$$;

revoke all on function public.admin_rotate_fa_access_code(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.admin_rotate_fa_access_code(uuid, uuid, text)
to service_role;

notify pgrst, 'reload schema';
