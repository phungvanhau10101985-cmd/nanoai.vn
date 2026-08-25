-- Sổ địa chỉ khách shop — nhiều địa chỉ / một mặc định, khớp UX 188.com.vn.
-- Additive. `messaging_partner_customer_profiles.shipping_address` vẫn là bản phẳng mặc định.

create table if not exists public.messaging_partner_customer_addresses (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  email_normalized text not null,
  full_name text not null default '',
  phone text not null default '',
  province text not null default '',
  district text not null default '',
  ward text not null default '',
  street_address text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mpca_partner_email
  on public.messaging_partner_customer_addresses (partner_id, email_normalized);

create unique index if not exists idx_mpca_partner_email_default
  on public.messaging_partner_customer_addresses (partner_id, email_normalized)
  where is_default;

comment on table public.messaging_partner_customer_addresses is
  'Sổ địa chỉ giao hàng theo email khách (mọi shop). Một is_default=true mỗi partner+email.';

insert into public.messaging_partner_customer_addresses (
  partner_id,
  email_normalized,
  full_name,
  phone,
  street_address,
  is_default,
  created_at,
  updated_at
)
select
  p.partner_id,
  p.email_normalized,
  coalesce(nullif(trim(p.customer_name), ''), ''),
  coalesce(nullif(trim(p.customer_phone), ''), ''),
  trim(p.shipping_address),
  true,
  now(),
  now()
from public.messaging_partner_customer_profiles p
where coalesce(trim(p.shipping_address), '') <> ''
  and not exists (
    select 1
    from public.messaging_partner_customer_addresses a
    where a.partner_id = p.partner_id
      and a.email_normalized = p.email_normalized
  );
