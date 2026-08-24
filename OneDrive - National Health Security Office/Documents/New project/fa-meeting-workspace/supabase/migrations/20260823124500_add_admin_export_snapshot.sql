create function public.admin_export_snapshot(
  p_actor_id uuid,
  p_scope text,
  p_group_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_scope not in ('group', 'all')
      or (p_scope = 'group' and p_group_id is null)
      or not exists (
        select 1
        from public.admin_profiles ap
        where ap.user_id = p_actor_id
          and ap.role = 'admin'
          and ap.is_active
      )
    then null
    else (
      select jsonb_build_object(
        'meeting', to_jsonb(m),
        'groups', coalesce((
          select jsonb_agg(
            to_jsonb(g) || jsonb_build_object(
              'issues', coalesce((
                select jsonb_agg(to_jsonb(i) order by i.position)
                from public.issues i
                where i.meeting_id = m.id
                  and i.group_id = g.id
                  and i.deleted_at is null
              ), '[]'::jsonb)
            )
            order by g.group_no
          )
          from public.meeting_groups g
          where g.meeting_id = m.id
            and (p_scope = 'all' or g.id = p_group_id)
        ), '[]'::jsonb)
      )
      from public.meetings m
      where m.status = 'active'
        and (
          p_scope = 'all'
          or exists (
            select 1
            from public.meeting_groups selected_group
            where selected_group.meeting_id = m.id
              and selected_group.id = p_group_id
          )
        )
    )
  end;
$$;

revoke all on function public.admin_export_snapshot(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.admin_export_snapshot(uuid, text, uuid)
to service_role;
