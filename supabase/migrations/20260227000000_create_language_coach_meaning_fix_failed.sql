-- Cột đánh dấu đã thử chuẩn hóa nghĩa (1 lần tự động)
ALTER TABLE language_coach_daily_words ADD COLUMN IF NOT EXISTS meaning_fix_attempted BOOLEAN DEFAULT FALSE;
ALTER TABLE language_coach_review_queue ADD COLUMN IF NOT EXISTS meaning_fix_attempted BOOLEAN DEFAULT FALSE;

-- Bảng lưu từ chuẩn hóa nghĩa mẹ đẻ thất bại (admin fix lại hoặc sửa thủ công)
create table if not exists public.language_coach_meaning_fix_failed (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  target_language text,
  native_language text,
  user_id uuid references auth.users(id) on delete set null,
  source_table text not null,
  source_id uuid,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_meaning_fix_failed_created
  on public.language_coach_meaning_fix_failed(created_at desc);

alter table public.language_coach_meaning_fix_failed enable row level security;

create policy "meaning_fix_failed_admin_only"
  on public.language_coach_meaning_fix_failed
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
