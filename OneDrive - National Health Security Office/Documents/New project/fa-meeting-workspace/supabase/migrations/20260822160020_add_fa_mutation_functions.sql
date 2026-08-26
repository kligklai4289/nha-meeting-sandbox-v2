create or replace function public.fa_apply_mutation(
  p_session_id uuid,
  p_meeting_id uuid,
  p_group_id uuid,
  p_mutation_id uuid,
  p_kind text,
  p_target_id uuid,
  p_expected_row_version integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.fa_sessions%rowtype;
  v_group public.meeting_groups%rowtype;
  v_issue public.issues%rowtype;
  v_result jsonb;
  v_target_id uuid;
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
    select 1 from public.meetings
    where id = p_meeting_id and status = 'active'
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

  if p_kind = 'issue_upsert' then
    if p_target_id is null then
      return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
    end if;

    select * into v_issue
    from public.issues
    where id = p_target_id and meeting_id = p_meeting_id
      and group_id = p_group_id and deleted_at is null
    for update;

    if found then
      if v_issue.row_version <> p_expected_row_version then
        return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
      end if;
      update public.issues set
        position = (p_payload->>'position')::integer,
        topic = coalesce(p_payload->>'topic', ''),
        findings = coalesce(p_payload->>'findings', ''),
        proposal = coalesce(p_payload->>'proposal', ''),
        action_plan = coalesce(p_payload->>'actionPlan', ''),
        evaluation = coalesce(p_payload->>'monitoring', ''),
        stakeholder_roles = coalesce(p_payload->>'stakeholderRoles', '')
      where id = p_target_id
      returning * into v_issue;
    else
      if p_expected_row_version <> 0 then
        return jsonb_build_object('ok', false, 'code', 'TARGET_NOT_FOUND');
      end if;
      insert into public.issues (
        id, meeting_id, group_id, position, topic, findings, proposal,
        action_plan, evaluation, stakeholder_roles
      ) values (
        p_target_id, p_meeting_id, p_group_id,
        (p_payload->>'position')::integer,
        coalesce(p_payload->>'topic', ''), coalesce(p_payload->>'findings', ''),
        coalesce(p_payload->>'proposal', ''), coalesce(p_payload->>'actionPlan', ''),
        coalesce(p_payload->>'monitoring', ''), coalesce(p_payload->>'stakeholderRoles', '')
      ) returning * into v_issue;
    end if;
    v_target_id := v_issue.id;
    v_result := jsonb_build_object(
      'ok', true, 'replayed', false,
      'data', jsonb_build_object(
        'id', v_issue.id, 'groupId', v_issue.group_id,
        'sortOrder', v_issue.position + 1, 'topic', v_issue.topic,
        'findings', v_issue.findings, 'proposal', v_issue.proposal,
        'actionPlan', v_issue.action_plan, 'monitoring', v_issue.evaluation,
        'stakeholderRoles', v_issue.stakeholder_roles,
        'rowVersion', v_issue.row_version, 'createdAt', v_issue.created_at,
        'updatedAt', v_issue.updated_at
      )
    );
  elsif p_kind = 'issue_delete' then
    select * into v_issue from public.issues
    where id = p_target_id and meeting_id = p_meeting_id
      and group_id = p_group_id and deleted_at is null
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'TARGET_NOT_FOUND');
    end if;
    if v_issue.row_version <> p_expected_row_version then
      return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
    end if;
    update public.issues set deleted_at = now() where id = v_issue.id returning * into v_issue;
    v_target_id := v_issue.id;
    v_result := jsonb_build_object('ok', true, 'replayed', false, 'data', jsonb_build_object(
      'id', v_issue.id, 'groupId', v_issue.group_id, 'deleted', true,
      'rowVersion', v_issue.row_version, 'updatedAt', v_issue.updated_at
    ));
  elsif p_kind = 'group_update' then
    if v_group.row_version <> p_expected_row_version then
      return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
    end if;
    if coalesce(p_payload->>'status', '') not in ('draft', 'review_ready') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
    end if;
    update public.meeting_groups set
      presenter = coalesce(p_payload->>'presenter', ''),
      status = (p_payload->>'status')::public.group_status,
      finalized_at = null
    where id = p_group_id returning * into v_group;
    v_target_id := v_group.id;
    v_result := jsonb_build_object('ok', true, 'replayed', false, 'data', jsonb_build_object(
      'id', v_group.id, 'presenter', v_group.presenter, 'status', v_group.status,
      'rowVersion', v_group.row_version, 'finalizedAt', v_group.finalized_at,
      'updatedAt', v_group.updated_at
    ));
  elsif p_kind = 'group_finalize' then
    if v_group.row_version <> p_expected_row_version then
      return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
    end if;
    update public.meeting_groups set status = 'final', finalized_at = now()
    where id = p_group_id returning * into v_group;
    v_target_id := v_group.id;
    v_result := jsonb_build_object('ok', true, 'replayed', false, 'data', jsonb_build_object(
      'id', v_group.id, 'status', v_group.status, 'rowVersion', v_group.row_version,
      'finalizedAt', v_group.finalized_at, 'updatedAt', v_group.updated_at
    ));
  else
    return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
  end if;

  insert into public.mutation_receipts (
    mutation_id, fa_session_id, target_table, target_id, result
  ) values (
    p_mutation_id, p_session_id,
    case when p_kind like 'issue_%' then 'issues' else 'meeting_groups' end,
    v_target_id, v_result
  );

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id,
    meeting_id, group_id, request_id
  ) values (
    'fa', p_session_id, p_kind,
    case when p_kind like 'issue_%' then 'issues' else 'meeting_groups' end,
    v_target_id, p_meeting_id, p_group_id, p_mutation_id::text
  );

  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'code', 'INVALID_MUTATION');
end;
$$;

revoke all on function public.fa_apply_mutation(uuid, uuid, uuid, uuid, text, uuid, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.fa_apply_mutation(uuid, uuid, uuid, uuid, text, uuid, integer, jsonb)
to service_role;
