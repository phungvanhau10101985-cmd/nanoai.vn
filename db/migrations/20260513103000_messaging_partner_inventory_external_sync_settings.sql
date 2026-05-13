-- Bảng so khớp trường JSON kho web khách → kho NanoAI (Open Catalog / messaging_partner_inventory).

create table if not exists public.messaging_partner_inventory_external_sync_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  site_origin text not null default '',
  product_path_template text not null default '/san-pham/{slug}',
  products_list_url text not null default '',
  field_mapping jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now ()
);

comment on table public.messaging_partner_inventory_external_sync_settings is
  'Cấu hình tích hợp kho khách: URL gốc, template đường dẫn SP, và map trường NanoAI → đường dẫn JSON khách (dot).';

comment on column public.messaging_partner_inventory_external_sync_settings.field_mapping is
  'Object flat: nano_key → path (vd sku→product_id, consult_note→product_info).';
