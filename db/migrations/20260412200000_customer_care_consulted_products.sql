-- Đánh dấu sản phẩm đã «tư vấn» theo hội thoại (khách bấm Tư vấn → lưu URL chuẩn hoá), để sau reload vẫn hiện nút Mua hàng.

create table if not exists public.customer_care_consulted_products (
  conversation_id uuid not null references public.customer_care_conversations (id) on delete cascade,
  product_url_key text not null,
  consulted_at timestamptz not null default now (),
  primary key (conversation_id, product_url_key)
);

create index if not exists idx_customer_care_consulted_products_conv
  on public.customer_care_consulted_products (conversation_id);

comment on table public.customer_care_consulted_products is
  'Theo dõi URL sản phẩm đã gửi tin tư vấn từ thẻ/card trong widget chat; key = normalize URL (origin+path).';
