create or replace function private.audit_admin_change()
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

  -- Deleted parent rows can no longer satisfy audit-log foreign keys. Their
  -- original meeting/group identifiers remain available in before_data.
  if tg_op = 'DELETE' then
    v_meeting_id := null;
    v_group_id := null;
  else
    v_meeting_id := case
      when tg_table_name = 'meetings' then (v_row->>'id')::uuid
      else (v_row->>'meeting_id')::uuid
    end;
    v_group_id := case
      when tg_table_name = 'meeting_groups' then (v_row->>'id')::uuid
      when tg_table_name = 'issues' then (v_row->>'group_id')::uuid
      else null
    end;
  end if;

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
