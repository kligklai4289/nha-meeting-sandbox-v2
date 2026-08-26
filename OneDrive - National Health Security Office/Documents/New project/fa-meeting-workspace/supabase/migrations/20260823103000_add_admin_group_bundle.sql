create function private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_meeting_id uuid;
  v_group_id uuid;
begin
  if current_setting('app.suppress_admin_audit', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_actor is null or not private.is_active_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_meeting_id := case
    when tg_table_name = 'meetings' then (v_row->>'id')::uuid
    else (v_row->>'meeting_id')::uuid
  end;
  v_group_id := case
    when tg_table_name = 'meeting_groups' then (v_row->>'id')::uuid
    when tg_table_name = 'issues' then (v_row->>'group_id')::uuid
    else null
  end;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id,
    meeting_id, group_id, before_data, after_data
  ) values (
    'admin', v_actor, 'admin_' || lower(tg_op), tg_table_name,
    (v_row->>'id')::uuid, v_meeting_id, v_group_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_admin_change() from public, anon, authenticated;

create trigger meetings_admin_audit
after insert or update or delete on public.meetings
for each row execute function private.audit_admin_change();

create trigger meeting_groups_admin_audit
after insert or update or delete on public.meeting_groups
for each row execute function private.audit_admin_change();

create trigger issues_admin_audit
after insert or update or delete on public.issues
for each row execute function private.audit_admin_change();

create function public.admin_save_group_bundle(
  p_group_id uuid,
  p_expected_group_version integer,
  p_group jsonb,
  p_issues jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.meeting_groups%rowtype;
  v_before_group jsonb;
  v_item record;
  v_count integer;
  v_group_json jsonb;
  v_issues_json jsonb;
begin
  if not private.is_active_admin() then
    raise exception 'ADMIN_FORBIDDEN';
  end if;
  if jsonb_typeof(p_issues) <> 'array' or jsonb_array_length(p_issues) > 200 then
    raise exception 'INVALID_ISSUES';
  end if;

  select * into v_group from public.meeting_groups where id = p_group_id for update;
  if not found or v_group.row_version <> p_expected_group_version then
    raise exception 'VERSION_CONFLICT';
  end if;
  if coalesce(p_group->>'status', '') not in ('draft', 'review_ready', 'final') then
    raise exception 'INVALID_GROUP_STATUS';
  end if;
  v_before_group := to_jsonb(v_group);
  perform set_config('app.suppress_admin_audit', 'on', true);

  select count(*) into v_count
  from jsonb_to_recordset(p_issues) as x(id uuid, position integer)
  where position < 0 or position >= jsonb_array_length(p_issues);
  if v_count > 0 or (
    select count(distinct x.position)
    from jsonb_to_recordset(p_issues) as x(position integer)
  ) <> jsonb_array_length(p_issues) then
    raise exception 'INVALID_POSITIONS';
  end if;

  perform 1 from public.issues
  where group_id = p_group_id and deleted_at is null
  for update;

  for v_item in
    select * from jsonb_to_recordset(p_issues) as x(
      id uuid, "expectedRowVersion" integer, position integer,
      topic text, findings text, proposal text, "actionPlan" text,
      monitoring text, "stakeholderRoles" text
    )
  loop
    if v_item."expectedRowVersion" = 0 then
      if exists (select 1 from public.issues where id = v_item.id) then
        raise exception 'VERSION_CONFLICT';
      end if;
    elsif not exists (
      select 1 from public.issues
      where id = v_item.id and group_id = p_group_id
        and deleted_at is null and row_version = v_item."expectedRowVersion"
    ) then
      raise exception 'VERSION_CONFLICT';
    end if;
  end loop;

  update public.issues set position = position + 1000000
  where group_id = p_group_id and deleted_at is null;

  update public.issues set deleted_at = now()
  where group_id = p_group_id and deleted_at is null
    and id not in (select x.id from jsonb_to_recordset(p_issues) as x(id uuid));

  for v_item in
    select * from jsonb_to_recordset(p_issues) as x(
      id uuid, "expectedRowVersion" integer, position integer,
      topic text, findings text, proposal text, "actionPlan" text,
      monitoring text, "stakeholderRoles" text
    ) order by position
  loop
    if v_item."expectedRowVersion" = 0 then
      insert into public.issues (
        id, meeting_id, group_id, position, topic, findings, proposal,
        action_plan, evaluation, stakeholder_roles
      ) values (
        v_item.id, v_group.meeting_id, p_group_id, v_item.position,
        coalesce(v_item.topic, ''), coalesce(v_item.findings, ''), coalesce(v_item.proposal, ''),
        coalesce(v_item."actionPlan", ''), coalesce(v_item.monitoring, ''), coalesce(v_item."stakeholderRoles", '')
      );
    else
      update public.issues set
        position = v_item.position,
        topic = coalesce(v_item.topic, ''),
        findings = coalesce(v_item.findings, ''),
        proposal = coalesce(v_item.proposal, ''),
        action_plan = coalesce(v_item."actionPlan", ''),
        evaluation = coalesce(v_item.monitoring, ''),
        stakeholder_roles = coalesce(v_item."stakeholderRoles", '')
      where id = v_item.id;
    end if;
  end loop;

  update public.meeting_groups set
    name = coalesce(p_group->>'name', ''),
    scope = coalesce(p_group->>'scope', ''),
    presenter = coalesce(p_group->>'presenter', ''),
    status = (p_group->>'status')::public.group_status,
    finalized_at = case
      when p_group->>'status' = 'final' then coalesce(v_group.finalized_at, now())
      else null
    end
  where id = p_group_id
  returning * into v_group;

  v_group_json := jsonb_build_object(
    'id', v_group.id, 'meeting_id', v_group.meeting_id, 'group_no', v_group.group_no,
    'name', v_group.name, 'scope', v_group.scope, 'presenter', v_group.presenter,
    'status', v_group.status, 'row_version', v_group.row_version,
    'finalized_at', v_group.finalized_at, 'created_at', v_group.created_at, 'updated_at', v_group.updated_at
  );
  select coalesce(jsonb_agg(to_jsonb(i) order by i.position), '[]'::jsonb)
  into v_issues_json from public.issues i
  where i.group_id = p_group_id and i.deleted_at is null;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id,
    meeting_id, group_id, before_data, after_data
  ) values (
    'admin', auth.uid(), 'admin_save_group_bundle', 'meeting_groups', p_group_id,
    v_group.meeting_id, p_group_id, v_before_group,
    jsonb_build_object('group', v_group_json, 'issues', v_issues_json)
  );

  return jsonb_build_object('group', v_group_json, 'issues', v_issues_json);
end;
$$;

revoke all on function public.admin_save_group_bundle(uuid, integer, jsonb, jsonb)
from public, anon;
grant execute on function public.admin_save_group_bundle(uuid, integer, jsonb, jsonb)
to authenticated;
