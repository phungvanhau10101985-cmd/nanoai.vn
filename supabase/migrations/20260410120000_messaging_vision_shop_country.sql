-- Quốc gia / khu vực shop — gợi ý vùng Vision (GCP) khi lưu cài đặt AI Messaging
alter table public.messaging_partner_ai_settings
  add column if not exists vision_shop_country text null default null;

comment on column public.messaging_partner_ai_settings.vision_shop_country is
  'ISO 3166-1 alpha-2 (e.g. VN, US). Empty = user chose Vision region manually. Used with vision_location preset.';
