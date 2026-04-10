alter table if exists public.messaging_partner_inventory
  add column if not exists stock_qty int not null default 0;

comment on column public.messaging_partner_inventory.stock_qty is 'So luong ton kho hien tai.';
