-- Phí ship theo tỉnh: tỉnh không có dòng riêng thì dùng phí đồng giá
-- (messaging_partner_payment_settings.shipping_fee_amount). Additive.

create table if not exists public.messaging_partner_shipping_province_fees (
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  province text not null,
  fee_amount numeric(15, 0) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (partner_id, province),
  constraint messaging_partner_shipping_province_fees_fee_nonneg check (fee_amount >= 0)
);

comment on table public.messaging_partner_shipping_province_fees is
  'Phí ship riêng theo tỉnh/thành. Thiếu tỉnh = dùng phí đồng giá trên payment_settings.';

comment on column public.messaging_partner_shipping_province_fees.province is
  'Tên tỉnh/thành chuẩn VIETNAM_PROVINCES (vd. Hồ Chí Minh).';

comment on column public.messaging_partner_shipping_province_fees.fee_amount is
  'Phí ship VND cho tỉnh này (0 = miễn phí tỉnh đó, không phải «dùng đồng giá»).';

create index if not exists idx_mp_shipping_province_fees_partner
  on public.messaging_partner_shipping_province_fees (partner_id);
