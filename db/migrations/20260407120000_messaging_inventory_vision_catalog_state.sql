-- Vision Product Search: incremental sync state + opt-out from index (purge)

alter table public.messaging_partner_inventory
  add column if not exists vision_catalog_checksum text null,
  add column if not exists vision_catalog_synced_at timestamptz null,
  add column if not exists vision_catalog_excluded boolean not null default false;

comment on column public.messaging_partner_inventory.vision_catalog_checksum is
  'SHA-256 hex of image_url + name when last successfully indexed for Vision Product Search.';
comment on column public.messaging_partner_inventory.vision_catalog_synced_at is
  'Last time this row was successfully imported into the Vision catalog.';
comment on column public.messaging_partner_inventory.vision_catalog_excluded is
  'When true, row is skipped for sync and removed from Vision index (purge / opt-out).';
