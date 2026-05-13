-- Đồng bộ kho từ URL API khách (cron + manual): bật/tắt và lịch.
alter table public.messaging_partner_inventory_external_sync_settings
  add column if not exists catalog_auto_sync_enabled boolean not null default false,
  add column if not exists catalog_auto_sync_interval_minutes integer not null default 60,
  add column if not exists catalog_last_sync_at timestamptz,
  add column if not exists catalog_last_sync_error text;

comment on column public.messaging_partner_inventory_external_sync_settings.catalog_auto_sync_enabled is
  'Cron gọi GET products_list_url và reconcile kho Open Catalog khi bật.';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_auto_sync_interval_minutes is
  'Khoảng tối thiểu giữa hai lần đồng bộ tự động (phút, app giới hạn 15–1440).';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_last_sync_at is
  'Thời điểm lần đồng bộ (tay hoặc cron) gần nhất hoàn tất.';
comment on column public.messaging_partner_inventory_external_sync_settings.catalog_last_sync_error is
  'Lỗi gần nhất (nếu có); xóa khi chạy thành công.';
