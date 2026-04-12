-- Gợi ý tùy chỉnh để AI tư vấn khéo / hướng chốt đơn (bổ sung trên khối mặc định trong code).

alter table public.messaging_partner_ai_settings
  add column if not exists sales_coaching_instructions text not null default '';

comment on column public.messaging_partner_ai_settings.sales_coaching_instructions is
  'Chỉ dẫn bổ sung cho trợ lý AI: tư vấn mềm, gợi ý bước tiếp theo (size/đặt hàng), phù hợp ngành — ghép vào system prompt sau khối mặc định.';
