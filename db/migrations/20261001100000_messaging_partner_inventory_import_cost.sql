-- Giá nhập gốc, tách khỏi giá bán. Hàng Trung Quốc: cost_cny. Hàng Việt Nam: cost_vnd.

alter table public.messaging_partner_inventory
  add column if not exists cost_cny double precision null,
  add column if not exists cost_vnd double precision null;

comment on column public.messaging_partner_inventory.cost_cny is
  'Giá nhập nhân dân tệ lúc cào. Không phải giá bán. Trống với hàng Việt Nam.';
comment on column public.messaging_partner_inventory.cost_vnd is
  'Giá nhập đồng của hàng Việt Nam. Không phải giá bán. Trống với hàng Trung Quốc.';
