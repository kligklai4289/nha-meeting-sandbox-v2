create function public.admin_create_meeting(
  p_title text,
  p_fiscal_year integer,
  p_meeting_date date,
  p_starts_at time,
  p_ends_at time,
  p_location text
)
returns public.meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting public.meetings%rowtype;
  v_group_no integer;
  v_name text;
  v_scope text;
begin
  if not private.is_active_admin() then raise exception 'ADMIN_FORBIDDEN'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'MEETING_TITLE_REQUIRED'; end if;
  if p_fiscal_year <= 0 then raise exception 'MEETING_FISCAL_YEAR_INVALID'; end if;
  if p_ends_at <= p_starts_at then raise exception 'MEETING_TIME_INVALID'; end if;

  insert into public.meetings (
    title, fiscal_year, meeting_date, starts_at, ends_at, location, status
  ) values (
    btrim(p_title), p_fiscal_year, p_meeting_date, p_starts_at, p_ends_at,
    coalesce(btrim(p_location), ''), 'draft'
  ) returning * into v_meeting;

  for v_group_no in 1..3 loop
    select g.name, g.scope into v_name, v_scope
    from public.meeting_groups g
    join public.meetings m on m.id = g.meeting_id
    where g.group_no = v_group_no and m.id <> v_meeting.id
    order by (m.status = 'active') desc, m.meeting_date desc, m.created_at desc
    limit 1;

    insert into public.meeting_groups (
      meeting_id, group_no, name, scope, presenter, status
    ) values (
      v_meeting.id,
      v_group_no,
      coalesce(v_name, 'กลุ่ม ' || v_group_no::text),
      coalesce(v_scope, ''),
      '',
      'draft'
    );
  end loop;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id, meeting_id, after_data
  ) values (
    'admin', auth.uid(), 'admin_create_meeting', 'meetings', v_meeting.id,
    v_meeting.id, to_jsonb(v_meeting)
  );

  return v_meeting;
end;
$$;

create function public.admin_set_meeting_status(
  p_meeting_id uuid,
  p_status text
)
returns public.meetings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting public.meetings%rowtype;
  v_previous_active_id uuid;
  v_now timestamptz := now();
begin
  if not private.is_active_admin() then raise exception 'ADMIN_FORBIDDEN'; end if;
  if p_status not in ('active', 'closed') then raise exception 'MEETING_STATUS_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtext('admin_set_meeting_status'));

  select * into v_meeting
  from public.meetings
  where id = p_meeting_id
  for update;
  if not found then raise exception 'MEETING_NOT_FOUND'; end if;

  if p_status = 'active' then
    select id into v_previous_active_id
    from public.meetings
    where status = 'active' and id <> p_meeting_id
    for update;

    if v_previous_active_id is not null then
      update public.meetings set status = 'closed' where id = v_previous_active_id;
      update public.fa_sessions
      set revoked_at = v_now, updated_at = v_now
      where meeting_id = v_previous_active_id and revoked_at is null;
    end if;

    update public.fa_sessions
    set revoked_at = v_now, updated_at = v_now
    where meeting_id = p_meeting_id and revoked_at is null;
  else
    update public.fa_sessions
    set revoked_at = v_now, updated_at = v_now
    where meeting_id = p_meeting_id and revoked_at is null;
  end if;

  update public.meetings
  set status = p_status::public.meeting_status
  where id = p_meeting_id
  returning * into v_meeting;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id, meeting_id, after_data
  ) values (
    'admin', auth.uid(), 'admin_set_meeting_status', 'meetings', v_meeting.id,
    v_meeting.id,
    jsonb_build_object('status', v_meeting.status, 'previousActiveMeetingId', v_previous_active_id)
  );

  return v_meeting;
end;
$$;

create function public.admin_delete_draft_meeting(p_meeting_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting public.meetings%rowtype;
begin
  if not private.is_active_admin() then raise exception 'ADMIN_FORBIDDEN'; end if;

  select * into v_meeting
  from public.meetings
  where id = p_meeting_id
  for update;
  if not found then raise exception 'MEETING_NOT_FOUND'; end if;
  if v_meeting.status <> 'draft' then raise exception 'MEETING_DELETE_NOT_DRAFT'; end if;
  if exists (select 1 from public.issues where meeting_id = p_meeting_id) then
    raise exception 'MEETING_DELETE_HAS_DATA';
  end if;

  insert into public.audit_logs (
    actor_type, actor_id, action, target_table, target_id, meeting_id, before_data
  ) values (
    'admin', auth.uid(), 'admin_delete_draft_meeting', 'meetings', v_meeting.id,
    v_meeting.id, to_jsonb(v_meeting)
  );

  delete from public.meetings where id = p_meeting_id;
  return p_meeting_id;
end;
$$;

revoke all on function public.admin_create_meeting(text, integer, date, time, time, text)
from public, anon;
revoke all on function public.admin_set_meeting_status(uuid, text)
from public, anon;
revoke all on function public.admin_delete_draft_meeting(uuid)
from public, anon;

grant execute on function public.admin_create_meeting(text, integer, date, time, time, text)
to authenticated;
grant execute on function public.admin_set_meeting_status(uuid, text)
to authenticated;
grant execute on function public.admin_delete_draft_meeting(uuid)
to authenticated;
