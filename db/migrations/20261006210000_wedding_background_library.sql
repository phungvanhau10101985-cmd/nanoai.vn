-- Kho ảnh nền thiệp cưới dùng chung. Tạo mới vẫn trừ credit; chọn lại ảnh đã có thì không.
create table if not exists public.wedding_background_library (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  image_type text not null check (image_type in ('master', 'cover', 'invitation', 'event', 'rsvp', 'album', 'gift_qr', 'thanks')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists wedding_background_library_image_url_key
  on public.wedding_background_library (image_url);

create index if not exists idx_wedding_background_library_created
  on public.wedding_background_library (created_at desc);

insert into public.wedding_background_library (image_url, image_type, created_at)
select distinct on (image_url) image_url, type, created_at
from public.wedding_card_ai_images
where status = 'completed'
  and image_url <> ''
  and image_url not like '%private_bg%'
order by image_url, created_at asc
on conflict (image_url) do nothing;

alter table public.wedding_background_library enable row level security;

drop policy if exists "Wedding background library is readable." on public.wedding_background_library;
create policy "Wedding background library is readable."
  on public.wedding_background_library
  for select
  using (true);
