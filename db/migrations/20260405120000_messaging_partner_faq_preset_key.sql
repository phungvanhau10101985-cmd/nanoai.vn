-- FAQ mẫu: preset_key xác định câu hỏi thường gặp; từ khớp do nền tảng định nghĩa (không cần shop nhập).

alter table public.messaging_partner_faq
  add column if not exists preset_key text null;

create unique index if not exists messaging_partner_faq_partner_preset_unique
  on public.messaging_partner_faq (partner_id, preset_key)
  where preset_key is not null;

comment on column public.messaging_partner_faq.preset_key is 'Mã câu hỏi mẫu (platform); null = FAQ tuỳ chỉnh với trigger_keywords.';
