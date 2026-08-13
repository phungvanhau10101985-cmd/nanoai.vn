-- Cổng tra cứu vận chuyển web shop (NanoAI gọi server-to-server).
-- Shop điền URL + API key; AI dùng để trả lời tra đơn / mã vận / SĐT.
-- Additive-only. Key không bao giờ trả về client (cùng kiểu image_search_api_secret).

alter table public.messaging_partner_ai_settings
  add column if not exists shipping_lookup_url text not null default '',
  add column if not exists shipping_lookup_api_key text null;

comment on column public.messaging_partner_ai_settings.shipping_lookup_url is
  'HTTPS endpoint GET/POST tra cứu vận chuyển trên web shop (vd. https://shop.example/api/v1/shipping/lookup). Rỗng = chưa bật.';
comment on column public.messaging_partner_ai_settings.shipping_lookup_api_key is
  'API key shop cấp cho NanoAI (header X-Api-Key hoặc Authorization Bearer). Không gửi ra frontend.';
