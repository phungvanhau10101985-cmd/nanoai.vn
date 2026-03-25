-- Repair schema drift: bản ghi supabase_migrations.schema_migrations có thể đã có version cũ
-- (vd. 20260328120000) trong khi ALTER TABLE thực tế không chạy trên remote → thiếu cột layout_snapshot.
-- Migration này idempotent (IF NOT EXISTS / ON CONFLICT) — chạy an toàn nhiều lần.

-- --- exam_attempts: layout + khóa 1 attempt / user / session (theo 20260328120000) ---
alter table public.exam_attempts
  add column if not exists layout_snapshot jsonb;

comment on column public.exam_attempts.layout_snapshot is
  'JSON: { v, questionOrder, optionPerms } — cố định sau khi HS bấm Bắt đầu; submitted_at null = đang làm';

create unique index if not exists exam_attempts_unique_session_user
  on public.exam_attempts (session_id, user_id)
  where user_id is not null;

-- --- essay + grading (theo 20260327100000, 20260324120100) ---
alter table public.exam_attempts
  add column if not exists essay_submission jsonb not null default '{}'::jsonb;

comment on column public.exam_attempts.essay_submission is
  'Bài TL: { "<questionId>": { "text": "...", "imageUrls": ["..."] } }';

alter table public.exam_attempts
  add column if not exists grading_meta jsonb not null default '{}'::jsonb;

comment on column public.exam_attempts.grading_meta is
  'JSON: quizCorrect, quizTotal, quizPoints, quizPointsMax, essayPointsMax';

-- --- bucket ảnh tự luận (theo 20260327100000) ---
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exam-essay-images',
  'exam-essay-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read exam essay images" on storage.objects;
create policy "Public read exam essay images"
  on storage.objects for select
  using (bucket_id = 'exam-essay-images');
