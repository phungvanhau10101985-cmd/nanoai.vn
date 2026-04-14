-- Bản dịch FAQ (vi/en/zh/ja/ko) do DeepSeek sinh khi shop lưu; `answer` vẫn là bản shop nhập.
alter table public.messaging_partner_faq
  add column if not exists answer_i18n jsonb not null default '{}'::jsonb;

comment on column public.messaging_partner_faq.answer_i18n is
  'JSON: { "vi": "...", "en": "...", "zh": "...", "ja": "...", "ko": "..." } — bản gửi khách theo ui_locale.';
