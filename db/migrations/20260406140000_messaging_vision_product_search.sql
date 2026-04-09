-- Vision Product Search theo shop: đồng bộ ảnh kho lên GCS + index; khách gửi ảnh → gợi ý sản phẩm.

alter table public.messaging_partner_ai_settings
  add column if not exists vision_product_search_enabled boolean not null default false;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_location text not null default 'us-east1';

alter table public.messaging_partner_ai_settings
  add column if not exists vision_product_category text not null default 'general-v1';

/** Để trống = dùng biến môi trường GCS_VISION_CATALOG_BUCKET */
alter table public.messaging_partner_ai_settings
  add column if not exists vision_gcs_bucket text not null default '';

alter table public.messaging_partner_ai_settings
  add column if not exists vision_index_ready boolean not null default false;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_index_synced_at timestamptz null;

alter table public.messaging_partner_ai_settings
  add column if not exists vision_index_error text not null default '';

comment on column public.messaging_partner_ai_settings.vision_product_search_enabled is 'Bật gợi ý sản phẩm khi khách gửi ảnh (Google Vision Product Search).';
comment on column public.messaging_partner_ai_settings.vision_location is 'GCP region cho Vision Product Search (vd. us-east1).';
comment on column public.messaging_partner_ai_settings.vision_product_category is 'Danh mục index: general-v1, apparel-v2, homegoods-v2, toys-v2, packagedgoods-v1.';
comment on column public.messaging_partner_ai_settings.vision_gcs_bucket is 'Bucket GCS chứa CSV + ảnh catalog; rỗng = GCS_VISION_CATALOG_BUCKET.';
