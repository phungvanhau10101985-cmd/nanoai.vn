-- W4.10 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): giá dạng số có cấu trúc.
-- Additive-only, nullable — KHÔNG đổi hành vi price_hint (text) hiện có. Dòng cũ giữ
-- price_amount = null cho tới lần sửa/import kế tiếp (app code tự tính lại khi ghi).
-- Điều kiện bắt buộc trước khi lọc theo khoảng giá (W4.11).
alter table public.messaging_partner_inventory
  add column if not exists price_amount numeric(14, 2),
  add column if not exists price_currency text not null default 'VND';

alter table public.messaging_partner_inventory
  drop constraint if exists messaging_partner_inventory_price_amount_nonneg;

alter table public.messaging_partner_inventory
  add constraint messaging_partner_inventory_price_amount_nonneg
  check (price_amount is null or price_amount >= 0);

create index if not exists idx_messaging_partner_inventory_price_amount
  on public.messaging_partner_inventory (partner_id, price_amount)
  where price_amount is not null;

comment on column public.messaging_partner_inventory.price_amount is
  'Giá dạng số (VND mặc định) — tự tính từ price_hint khi tạo/sửa/import. NULL = chưa từng được tính lại (dòng cũ trước W4.10).';
comment on column public.messaging_partner_inventory.price_currency is
  'Mã tiền tệ ISO 4217 — mặc định VND cho tới khi có yêu cầu đa tiền tệ (S0.10).';
