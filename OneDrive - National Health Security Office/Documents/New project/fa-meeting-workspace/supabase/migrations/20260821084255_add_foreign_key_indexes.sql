create index admin_profiles_invited_by_idx
on public.admin_profiles (invited_by);

create index audit_logs_group_id_idx
on public.audit_logs (group_id);

create index fa_access_codes_created_by_idx
on public.fa_access_codes (created_by);

create index fa_sessions_meeting_group_idx
on public.fa_sessions (meeting_id, group_id);

create index mutation_receipts_fa_session_idx
on public.mutation_receipts (fa_session_id);
