-- Phân loại lượt gọi: chat LLM (null) vs tạo ảnh inbox (AI).
alter table public.messaging_partner_ai_token_usage
  add column if not exists usage_kind text null default null;

comment on column public.messaging_partner_ai_token_usage.usage_kind is
  'null = chat LLM inbox; image_material_detail | image_real_use = Gemini tạo ảnh (chất liệu / thực tế).';

create index if not exists idx_messaging_partner_ai_token_usage_partner_kind_created
  on public.messaging_partner_ai_token_usage (partner_id, usage_kind, created_at desc)
  where usage_kind is not null;
