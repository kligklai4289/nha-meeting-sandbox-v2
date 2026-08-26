begin;
set local search_path = public, extensions;
select plan(36);

select has_table('public', 'meetings', 'meetings table exists');
select has_table('public', 'meeting_groups', 'meeting_groups table exists');
select has_table('public', 'issues', 'issues table exists');
select has_table('public', 'fa_access_codes', 'fa_access_codes table exists');
select has_table('public', 'fa_access_attempts', 'fa_access_attempts table exists');
select has_table('public', 'fa_sessions', 'fa_sessions table exists');
select has_table('public', 'admin_profiles', 'admin_profiles table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');
select has_table('public', 'mutation_receipts', 'mutation_receipts table exists');

select has_type('public', 'meeting_status', 'meeting_status enum exists');
select has_type('public', 'group_status', 'group_status enum exists');
select has_type('public', 'admin_role', 'admin_role enum exists');
select has_type('public', 'actor_type', 'actor_type enum exists');
select has_schema('private', 'private schema exists');
select ok(to_regprocedure('private.is_active_admin()') is not null, 'private admin helper exists');

select has_column('public', 'issues', 'topic', 'issues.topic exists');
select has_column('public', 'issues', 'findings', 'issues.findings exists');
select has_column('public', 'issues', 'proposal', 'issues.proposal exists');
select has_column('public', 'issues', 'action_plan', 'issues.action_plan exists');
select has_column('public', 'issues', 'evaluation', 'issues.evaluation exists');
select has_column('public', 'issues', 'stakeholder_roles', 'issues.stakeholder_roles exists');
select col_type_is('public', 'issues', 'row_version', 'integer', 'issue versions use integers');
select col_not_null('public', 'issues', 'row_version', 'issue versions are required');

select has_index('public', 'meetings', 'one_active_meeting', 'one active meeting index exists');
select has_index('public', 'meeting_groups', 'meeting_groups_meeting_group_no_key', 'group number is unique per meeting');
select has_index('public', 'issues', 'issues_active_position_key', 'active issue position is unique per group');
select has_index('public', 'fa_access_codes', 'fa_access_codes_active_code_per_meeting', 'active FA codes are unique per meeting');

select results_eq(
  $$
    select count(*)::bigint
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname = any(array[
        'meetings', 'meeting_groups', 'issues', 'fa_access_codes', 'fa_access_attempts',
        'fa_sessions', 'admin_profiles', 'audit_logs', 'mutation_receipts'
      ])
      and relrowsecurity
  $$,
  array[9::bigint],
  'RLS is enabled on all public application tables'
);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
      and table_name = any(array[
        'meetings', 'meeting_groups', 'issues', 'fa_access_codes', 'fa_access_attempts',
        'fa_sessions', 'admin_profiles', 'audit_logs', 'mutation_receipts'
      ])
  $$,
  array[0::bigint],
  'anonymous role has no table mutation grants'
);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.routine_privileges
    where routine_schema = 'private'
      and routine_name = 'is_active_admin'
      and grantee in ('PUBLIC', 'anon')
  $$,
  array[0::bigint],
  'private admin helper is not executable by public or anon'
);

select ok(
  has_table_privilege('authenticated', 'public.admin_profiles', 'SELECT'),
  'authenticated may select admin profiles through RLS'
);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'admin_profiles'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  array[0::bigint],
  'authenticated cannot mutate admin profiles directly'
);

select results_eq(
  $$
    select has_table_privilege('authenticated', 'public.admin_profiles', privilege_type)
    from unnest(array['INSERT', 'UPDATE', 'DELETE']) with ordinality as privileges(privilege_type, ordinality)
    order by ordinality
  $$,
  array[false, false, false],
  'authenticated has no effective admin profile mutation privileges'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_profiles'
      and policyname = 'active_admin_select'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
      and qual like '%private.is_active_admin%'
  $$,
  array[1::bigint],
  'admin profile select policy is restricted to active authenticated admins'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_groups'
  $$,
  array[1::bigint],
  'meeting groups are published to Realtime'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issues'
  $$,
  array[1::bigint],
  'issues are published to Realtime'
);

select * from finish();
rollback;
