-- Số hàng đơn chiếm trên Google Sheet (mỗi mẫu một hàng); null = legacy (coi như 1).
alter table public.messaging_partner_orders
  add column if not exists google_sheet_row_count integer null;

comment on column public.messaging_partner_orders.google_sheet_row_count is
  'Số dòng liên tiếp trên Google Sheet từ google_sheet_row; mỗi mẫu một hàng khi >1.';
