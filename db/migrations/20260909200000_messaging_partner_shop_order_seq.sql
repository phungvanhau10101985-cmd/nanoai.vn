-- Mã đơn ngắn theo shop: 188.com.vn → 188COMVN01, 188COMVN02…
-- Bộ đếm atomic trên messaging_partners; payment_reference lưu mã lõi (không UUID).

alter table public.messaging_partners
  add column if not exists shop_order_seq integer not null default 0;

comment on column public.messaging_partners.shop_order_seq is
  'Số thứ tự mã đơn shop (188COMVN01…). Tăng lúc checkout; không đụng đơn cũ.';

do $$
begin
  if not exists (
    select 1 from pg_indexes where indexname = 'messaging_partner_orders_partner_payment_ref_uidx'
  ) then
    if not exists (
      select 1
      from public.messaging_partner_orders
      where length(trim(payment_reference)) > 0
      group by partner_id, upper(trim(payment_reference))
      having count(*) > 1
    ) then
      create unique index messaging_partner_orders_partner_payment_ref_uidx
        on public.messaging_partner_orders (partner_id, (upper(trim(payment_reference))))
        where length(trim(payment_reference)) > 0;
    end if;
  end if;
end $$;
