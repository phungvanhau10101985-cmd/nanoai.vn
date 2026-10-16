-- Gắn nền và khung AI được tạo từ cùng một ảnh tham khảo trong kho.
alter table public.wedding_background_library
  add column if not exists reference_image_url text not null default '';

alter table public.wedding_cover_frame_library
  add column if not exists reference_image_url text not null default '';
