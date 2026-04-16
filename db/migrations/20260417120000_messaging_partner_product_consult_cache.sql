-- Cache nội dung tư vấn thẻ SP theo giới tính + locale — tái dùng cho khách cùng SP + cùng giới.

create table if not exists public.messaging_partner_product_consult_cache (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  inventory_id uuid not null references public.messaging_partner_inventory(id) on delete cascade,
  gender text not null,
  ui_locale text not null default 'vi',
  message_text text not null,
  ai_product_cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messaging_partner_product_consult_cache_gender_chk
    check (gender in ('male', 'female', 'other')),
  constraint messaging_partner_product_consult_cache_locale_len_chk
    check (char_length(ui_locale) <= 12)
);

create unique index if not exists uq_messaging_partner_product_consult_cache_key
  on public.messaging_partner_product_consult_cache (partner_id, inventory_id, gender, ui_locale);

create index if not exists idx_messaging_partner_product_consult_cache_partner_inv
  on public.messaging_partner_product_consult_cache (partner_id, inventory_id);

comment on table public.messaging_partner_product_consult_cache is 'Tư vấn thẻ SP (product_card_consult) — cache theo giới + locale để tránh gọi LLM lặp.';
