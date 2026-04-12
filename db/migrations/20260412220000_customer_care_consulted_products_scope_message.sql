-- «Đã tư vấn» theo cặp (tin nhắn chứa thẻ + URL SP) — cùng SP ở tin/carousel khác vẫn là Tư vấn.

delete from public.customer_care_consulted_products;

alter table public.customer_care_consulted_products
  drop constraint customer_care_consulted_products_pkey;

alter table public.customer_care_consulted_products
  add column source_message_id uuid not null references public.customer_care_messages (id) on delete cascade;

alter table public.customer_care_consulted_products
  add primary key (conversation_id, source_message_id, product_url_key);

comment on table public.customer_care_consulted_products is
  'Đã bấm Tư vấn trên thẻ: theo tin nhắn nguồn + URL chuẩn hoá — không gộp giữa các tin.';

comment on column public.customer_care_consulted_products.source_message_id is
  'customer_care_messages.id của tin có thẻ (AI outbound hoặc tin vision có carousel).';
