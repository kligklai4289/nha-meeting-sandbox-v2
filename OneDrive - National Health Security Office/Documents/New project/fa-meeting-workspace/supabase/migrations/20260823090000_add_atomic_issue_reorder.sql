create function public.fa_reorder_issues(
  p_session_id uuid,
  p_meeting_id uuid,
  p_group_id uuid,
  p_mutation_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.fa_sessions%rowtype;
  v_group public.meeting_groups%rowtype;
  v_result jsonb;
  v_issues jsonb;
  v_item_count integer;
  v_match_count integer;
  v_min_position integer;
  v_max_position integer;
  v_distinct_positions integer;
begin
  select result into v_result
  from public.mutation_receipts
  where mutation_id = p_mutation_id;
  if found then
    return jsonb_set(v_result, '{replayed}', 'true'::jsonb, true);
  end if;

  select * into v_session
  from public.fa_sessions
  where id = p_session_id
    and meeting_id = p_meeting_id
    and group_id = p_group_id
    and revoked_at is null
    and expires_at > now();
  if not found or v_session.id is null then
    return jsonb_build_object('ok', false, 'code', 'FA_SESSION_INVALID');
  end if;

  if not exists (
    select 1 from public.meetings where id = p_meeting_id and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'MEETING_INACTIVE');
  end if;

  select * into v_group
  from public.meeting_groups
  where id = p_group_id and meeting_id = p_meeting_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'FA_SESSION_INVALID');
  end if;
  if v_group.status = 'final' then
    return jsonb_build_object('ok', false, 'code', 'GROUP_FINALIZED');
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
  end if;

  select count(*), min(position), max(position), count(distinct position)
  into v_item_count, v_min_position, v_max_position, v_distinct_positions
  from jsonb_to_recordset(p_items) as x(id uuid, "expectedRowVersion" integer, position integer);

  if v_min_position <> 0
    or v_max_position <> v_item_count - 1
    or v_distinct_positions <> v_item_count then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
  end if;

  select count(*) into v_match_count
  from public.issues i
  join jsonb_to_recordset(p_items) as x(id uuid, "expectedRowVersion" integer, position integer)
    on x.id = i.id and x."expectedRowVersion" = i.row_version
  where i.meeting_id = p_meeting_id
    and i.group_id = p_group_id
    and i.deleted_at is null;

  if v_match_count <> v_item_count
    or v_item_count <> (
      select count(*) from public.issues
      where meeting_id = p_meeting_id and group_id = p_group_id and deleted_at is null
    ) then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  end if;

  perform 1 from public.issues
  where meeting_id = p_meeting_id and group_id = p_group_id and deleted_at is null
  for update;

  update public.issues
  set position = position + 1000000
  where meeting_id = p_meeting_id and group_id = p_group_id and deleted_at is null;

  update public.issues i set
    position = x.position,
    topic = coalesce(x.topic, ''),
    findings = coalesce(x.findings, ''),
    proposal = coalesce(x.proposal, ''),
    action_plan = coalesce(x."actionPlan", ''),
    evaluation = coalesce(x.monitoring, ''),
    stakeholder_roles = coalesce(x."stakeholderRoles", '')
  from jsonb_to_recordset(p_items) as x(
    id uuid, "expectedRowVersion" integer, position integer,
    topic text, findings text, proposal text, "actionPlan" text,
    monitoring text, "stakeholderRoles" text
  )
  where i.id = x.id
    and i.meeting_id = p_meeting_id
    and i.group_id = p_group_id
    and i.deleted_at is null;

  select jsonb_agg(jsonb_build_object(
    'id', i.id, 'groupId', i.group_id, 'sortOrder', i.position + 1,
    'topic', i.topic, 'findings', i.findings, 'proposal', i.proposal,
    'actionPlan', i.action_plan, 'monitoring', i.evaluation,
    'stakeholderRoles', i.stakeholder_roles, 'rowVersion', i.row_version,
    'createdAt', i.created_at, 'updatedAt', i.updated_at
  ) order by i.position)
  into v_issues
  from public.issues i
  where i.meeting_id = p_meeting_id and i.group_id = p_group_id and i.deleted_at is null;

  v_result := jsonb_build_object(
    'ok', true, 'replayed', false,
    'data', jsonb_build_object('issues', v_issues)
  );

  insert into public.mutation_receipts (
    mutation_id, fa_session_id, target_table, target_id, result
  ) values (p_mutation_id, p_session_id, 'issues', null, v_result);

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id,
    meeting_id, group_id, request_id
  ) values (
    'fa', p_session_id, 'issues_reorder', 'issues', null,
    p_meeting_id, p_group_id, p_mutation_id::text
  );

  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
end;
$$;

revoke all on function public.fa_reorder_issues(uuid, uuid, uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.fa_reorder_issues(uuid, uuid, uuid, uuid, jsonb)
to service_role;
