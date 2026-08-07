-- Full sync khởi tạo có checkpoint trước khi chuyển sang incremental sync.
-- Các catalog lớn được xử lý nhiều lượt cron; chỉ dùng updated_since bình thường
-- sau khi đã duyệt hết toàn bộ trang từ epoch.
alter table public.messaging_partner_inventory_external_sync_settings
  add column if not exists catalog_initial_sync_status text not null default 'pending',
  add column if not exists catalog_initial_sync_next_page integer not null default 1,
  add column if not exists catalog_initial_sync_total_pages integer,
  add column if not exists catalog_initial_sync_started_at timestamptz;

alter table public.messaging_partner_inventory_external_sync_settings
  drop constraint if exists messaging_partner_inventory_external_sync_initial_status_check;

alter table public.messaging_partner_inventory_external_sync_settings
  add constraint messaging_partner_inventory_external_sync_initial_status_check
  check (catalog_initial_sync_status in ('pending', 'running', 'completed'));

alter table public.messaging_partner_inventory_external_sync_settings
  drop constraint if exists messaging_partner_inventory_external_sync_initial_next_page_check;

alter table public.messaging_partner_inventory_external_sync_settings
  add constraint messaging_partner_inventory_external_sync_initial_next_page_check
  check (catalog_initial_sync_next_page >= 1);

comment on column public.messaging_partner_inventory_external_sync_settings.catalog_initial_sync_status is
  'Trạng thái full sync khởi tạo: pending/running/completed. Chỉ completed mới chạy updated_since incremental.';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_initial_sync_next_page is
  'Trang API 188 tiếp theo cần xử lý trong full sync khởi tạo (page bắt đầu từ 1).';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_initial_sync_total_pages is
  'Tổng trang từ pagination.total_pages của API 188 ở lượt full sync khởi tạo.';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_initial_sync_started_at is
  'Thời điểm bắt đầu full sync khởi tạo để hiển thị tiến độ và chẩn đoán.';
