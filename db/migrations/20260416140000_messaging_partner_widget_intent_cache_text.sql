-- Lưu thêm chuỗi chuẩn hoá (khách + tin shop) để đối chiếu/audit; khóa tra vẫn là lookup_hash.

alter table public.messaging_partner_widget_intent_cache
  add column if not exists customer_text_norm text not null default '',
  add column if not exists shop_context_norm text not null default '';

comment on column public.messaging_partner_widget_intent_cache.customer_text_norm is
  'Tin khách đã chuẩn hoá (trim, lower, gom khoảng trắng) — khớp logic buildWidgetIntentLookupHash.';
comment on column public.messaging_partner_widget_intent_cache.shop_context_norm is
  'Tin shop outbound gần nhất đã chuẩn hoá — cùng logic fingerprint ngữ cảnh.';
