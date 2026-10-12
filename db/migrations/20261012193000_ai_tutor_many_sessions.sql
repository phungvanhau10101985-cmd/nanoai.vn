-- Một học sinh có nhiều hội thoại với gia sư. Phiên đang xem là bản cập nhật mới nhất.

alter table public.tutor_sessions drop constraint if exists tutor_sessions_user_unique;

create index if not exists tutor_sessions_user_updated_idx
  on public.tutor_sessions (user_id, updated_at desc);

comment on table public.tutor_sessions is
  'Các hội thoại 1:1 giữa một học sinh và gia sư AI. Hội thoại đang mở là bản updated_at mới nhất.';
