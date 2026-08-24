create extension if not exists pgcrypto with schema extensions;

create type public.meeting_status as enum ('draft', 'active', 'closed');
create type public.group_status as enum ('draft', 'review_ready', 'final');
create type public.admin_role as enum ('admin');
create type public.actor_type as enum ('fa', 'admin', 'system');

create schema if not exists private;
revoke all on schema private from public, anon;

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  fiscal_year integer not null check (fiscal_year > 0),
  meeting_date date not null,
  starts_at time not null,
  ends_at time not null,
  location text not null default '',
  status public.meeting_status not null default 'draft',
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index one_active_meeting
on public.meetings ((status))
where status = 'active';

create table public.meeting_groups (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  group_no smallint not null check (group_no between 1 and 3),
  name text not null,
  scope text not null default '',
  presenter text not null default '',
  status public.group_status not null default 'draft',
  row_version integer not null default 1 check (row_version > 0),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, group_no),
  unique (meeting_id, id),
  check ((status = 'final' and finalized_at is not null) or status <> 'final')
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  group_id uuid not null,
  position integer not null check (position >= 0),
  topic text not null default '',
  findings text not null default '',
  proposal text not null default '',
  action_plan text not null default '',
  evaluation text not null default '',
  stakeholder_roles text not null default '',
  row_version integer not null default 1 check (row_version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, group_id)
    references public.meeting_groups(meeting_id, id)
    on delete cascade
);

create unique index issues_active_position_key
on public.issues (meeting_id, group_id, position)
where deleted_at is null;

create table public.fa_access_codes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  group_id uuid not null,
  code_hash text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, group_id)
    references public.meeting_groups(meeting_id, id)
    on delete cascade
);

create unique index fa_access_codes_one_active_per_group
on public.fa_access_codes (meeting_id, group_id)
where is_active;

create table public.fa_sessions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  group_id uuid not null,
  session_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (meeting_id, group_id)
    references public.meeting_groups(meeting_id, id)
    on delete cascade
);

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type public.actor_type not null,
  actor_id uuid,
  action text not null,
  target_table text not null,
  target_id uuid,
  meeting_id uuid references public.meetings(id) on delete set null,
  group_id uuid references public.meeting_groups(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  mutation_id uuid not null unique,
  fa_session_id uuid references public.fa_sessions(id) on delete set null,
  target_table text not null,
  target_id uuid,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_status_idx on public.meetings (status);
create index meeting_groups_meeting_idx on public.meeting_groups (meeting_id, group_no);
create index issues_group_position_idx on public.issues (group_id, position) where deleted_at is null;
create index fa_access_codes_group_idx on public.fa_access_codes (group_id) where is_active;
create index fa_sessions_live_group_idx on public.fa_sessions (group_id, expires_at)
where revoked_at is null;
create index audit_logs_meeting_created_idx on public.audit_logs (meeting_id, created_at desc);

create function private.set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['updated_at', 'row_version'])
     is distinct from
     (to_jsonb(old) - array['updated_at', 'row_version']) then
    new.updated_at = now();
    new.row_version = old.row_version + 1;
  else
    new.updated_at = old.updated_at;
    new.row_version = old.row_version;
  end if;
  return new;
end;
$$;

revoke all on function private.set_updated_at_and_version() from public, anon, authenticated;

create trigger meetings_set_updated_at_and_version
before update on public.meetings
for each row execute function private.set_updated_at_and_version();

create trigger meeting_groups_set_updated_at_and_version
before update on public.meeting_groups
for each row execute function private.set_updated_at_and_version();

create trigger issues_set_updated_at_and_version
before update on public.issues
for each row execute function private.set_updated_at_and_version();

create function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = (select auth.uid())
      and is_active = true
  );
$$;

revoke all on function private.is_active_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_active_admin() to authenticated;

alter table public.meetings enable row level security;
alter table public.meeting_groups enable row level security;
alter table public.issues enable row level security;
alter table public.fa_access_codes enable row level security;
alter table public.fa_sessions enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.mutation_receipts enable row level security;

revoke insert, update, delete, truncate, references, trigger
on public.meetings, public.meeting_groups, public.issues, public.fa_access_codes,
   public.fa_sessions, public.admin_profiles, public.audit_logs, public.mutation_receipts
from anon;

grant select, insert, update, delete on public.meetings, public.meeting_groups, public.issues
to authenticated;
grant select on public.fa_access_codes, public.fa_sessions, public.admin_profiles, public.audit_logs
to authenticated;
grant all on public.meetings, public.meeting_groups, public.issues, public.fa_access_codes,
  public.fa_sessions, public.admin_profiles, public.audit_logs, public.mutation_receipts
to service_role;

create policy active_admin_select on public.meetings
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_insert on public.meetings
for insert to authenticated with check ((select private.is_active_admin()));
create policy active_admin_update on public.meetings
for update to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy active_admin_delete on public.meetings
for delete to authenticated using ((select private.is_active_admin()));

create policy active_admin_select on public.meeting_groups
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_insert on public.meeting_groups
for insert to authenticated with check ((select private.is_active_admin()));
create policy active_admin_update on public.meeting_groups
for update to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy active_admin_delete on public.meeting_groups
for delete to authenticated using ((select private.is_active_admin()));

create policy active_admin_select on public.issues
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_insert on public.issues
for insert to authenticated with check ((select private.is_active_admin()));
create policy active_admin_update on public.issues
for update to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));
create policy active_admin_delete on public.issues
for delete to authenticated using ((select private.is_active_admin()));

create policy active_admin_select on public.fa_access_codes
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_select on public.fa_sessions
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_select on public.admin_profiles
for select to authenticated using ((select private.is_active_admin()));
create policy active_admin_select on public.audit_logs
for select to authenticated using ((select private.is_active_admin()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_groups'
  ) then
    alter publication supabase_realtime add table public.meeting_groups;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issues'
  ) then
    alter publication supabase_realtime add table public.issues;
  end if;
end;
$$;
