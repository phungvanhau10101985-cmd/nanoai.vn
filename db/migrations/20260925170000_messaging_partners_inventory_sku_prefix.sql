-- Chữ cái đầu SKU shop SaaS: một chữ A–Z cố định mỗi shop (gudo → G). Không dùng chung.

alter table public.messaging_partners
  add column if not exists inventory_sku_prefix text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partners_inventory_sku_prefix_check'
  ) then
    alter table public.messaging_partners
      add constraint messaging_partners_inventory_sku_prefix_check
      check (inventory_sku_prefix is null or inventory_sku_prefix ~ '^[A-Z]$');
  end if;
end$$;

create unique index if not exists messaging_partners_inventory_sku_prefix_uidx
  on public.messaging_partners (inventory_sku_prefix)
  where inventory_sku_prefix is not null;

comment on column public.messaging_partners.inventory_sku_prefix is
  'Chữ hoa random, cố định đầu mã SKU shop (vd Q → Qa0001). Không lấy từ tên shop. Mỗi shop một chữ.';
