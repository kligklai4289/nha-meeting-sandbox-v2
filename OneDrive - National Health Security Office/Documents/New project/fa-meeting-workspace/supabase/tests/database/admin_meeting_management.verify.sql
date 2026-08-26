begin;
set local search_path = public, extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '90000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'meeting-verify@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.admin_profiles (user_id, display_name, role, is_active)
values ('90000000-0000-4000-8000-000000000003', 'Meeting verifier', 'admin', true);

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000003';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  v_created public.meetings%rowtype;
begin
  select * into v_created from public.admin_create_meeting(
    'รอบทดสอบจัดการ', 2570, '2026-09-01', '09:00', '16:00', 'ห้องทดสอบ'
  );
  if v_created.status <> 'draft' then raise exception 'New meeting is not a draft'; end if;
  if (select count(*) from public.meeting_groups where meeting_id = v_created.id) <> 3 then
    raise exception 'New meeting does not have three groups';
  end if;

  perform public.admin_set_meeting_status(v_created.id, 'active');
  if (select count(*) from public.meetings where status = 'active') <> 1 then
    raise exception 'More than one meeting is active';
  end if;
  if (select status from public.meetings where id = v_created.id) <> 'active' then
    raise exception 'Target meeting was not activated';
  end if;

  perform public.admin_set_meeting_status(v_created.id, 'closed');
  if (select status from public.meetings where id = v_created.id) <> 'closed' then
    raise exception 'Target meeting was not closed';
  end if;

  update public.meetings set status = 'draft' where id = v_created.id;
  if public.admin_delete_draft_meeting(v_created.id) <> v_created.id then
    raise exception 'Draft meeting delete did not return its id';
  end if;
  if exists (select 1 from public.meetings where id = v_created.id) then
    raise exception 'Draft meeting was not deleted';
  end if;
end;
$$;

select 'Admin meeting management verification passed' as result;
rollback;
