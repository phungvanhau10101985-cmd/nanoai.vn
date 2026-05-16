-- Đồng bộ kho từ URL API khách theo giờ Việt Nam (Asia/Ho_Chi_Minh).
alter table public.messaging_partner_inventory_external_sync_settings
  add column if not exists catalog_auto_sync_time_vn time not null default '03:00';

comment on column public.messaging_partner_inventory_external_sync_settings.catalog_auto_sync_time_vn is
  'Giờ Việt Nam (HH:MI, Asia/Ho_Chi_Minh) để cron đồng bộ Open Catalog tối đa 1 lần/ngày.';
