-- Bổ sung try_on_history + enum khi init.sql chưa chạy trọn (DB lệch).
do $$
begin
  create type public.try_on_status as enum ('processing', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.try_on_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  original_image_url text not null default '',
  garment_image_url text not null default '',
  result_image_url text,
  status public.try_on_status not null default 'processing',
  created_at timestamptz not null default timezone('utc'::text, now())
);
