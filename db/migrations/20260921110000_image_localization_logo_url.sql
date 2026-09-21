alter table if exists public.messaging_partner_image_localization_settings
  add column if not exists logo_url text;

comment on column public.messaging_partner_image_localization_settings.logo_url is
  'Logo tùy chọn đóng lên các ảnh đã được bản địa hóa và tải lên Bunny CDN của NanoAI.';
