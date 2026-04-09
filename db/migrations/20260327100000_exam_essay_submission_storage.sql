-- Ảnh bài làm tự luận + payload JSON (đường dẫn/URL) trên exam_attempts
alter table public.exam_attempts
  add column if not exists essay_submission jsonb not null default '{}'::jsonb;

comment on column public.exam_attempts.essay_submission is
  'Bài TL: { "<questionId>": { "text": "...", "imageUrls": ["..."] } }';

-- Bucket ảnh bài thi (đọc public; ghi qua API service role)
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
