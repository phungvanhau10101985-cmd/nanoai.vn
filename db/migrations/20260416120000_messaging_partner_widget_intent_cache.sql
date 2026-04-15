-- Cache kết quả phân loại ý định widget (DeepSeek): (tin khách + fingerprint tin shop gần nhất + version).
-- Tra trước khi gọi API; khóa SHA-256 gồm partner + chuẩn hoá nội dung + ngữ cảnh.

create table if not exists public.messaging_partner_widget_intent_cache (
  lookup_hash char(64) primary key,
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  decision text not null
    check (decision in ('context_reply', 'clarify', 'product_search')),
  classifier_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_widget_intent_cache_partner
  on public.messaging_partner_widget_intent_cache (partner_id);

comment on table public.messaging_partner_widget_intent_cache is
  'Cache phân loại ý định tin widget (context_reply | clarify | product_search). Khóa = SHA-256(version + partner + khách + ngữ cảnh shop).';
