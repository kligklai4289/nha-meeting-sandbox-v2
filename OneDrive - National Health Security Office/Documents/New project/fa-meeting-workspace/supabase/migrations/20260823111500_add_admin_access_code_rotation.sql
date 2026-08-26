create function public.admin_rotate_fa_access_code(
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

  select * into v_group
  from public.meeting_groups
  where id = p_group_id
  for update;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;

  update public.fa_access_codes
  set is_active = false, updated_at = v_rotated_at
  where meeting_id = v_group.meeting_id and group_id = p_group_id and is_active = true;

  insert into public.fa_access_codes (
    meeting_id, group_id, code_hash, is_active, created_by, rotated_at
  ) values (
    v_group.meeting_id, p_group_id, p_code_hash, true, p_actor_id, v_rotated_at
  );

  update public.fa_sessions
  set revoked_at = v_rotated_at, updated_at = v_rotated_at
  where meeting_id = v_group.meeting_id and group_id = p_group_id
    and revoked_at is null and expires_at > v_rotated_at;
  get diagnostics v_revoked_sessions = row_count;

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
