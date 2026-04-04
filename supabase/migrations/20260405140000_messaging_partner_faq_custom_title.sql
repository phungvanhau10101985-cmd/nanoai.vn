-- Tiêu đề câu hỏi do shop tự thêm (chỉ hiển thị trong dashboard; khớp tin dùng trigger_keywords).

alter table public.messaging_partner_faq
  add column if not exists custom_title text not null default '';

comment on column public.messaging_partner_faq.custom_title is 'Shop-defined FAQ title/hint for dashboard list; matching uses trigger_keywords.';
