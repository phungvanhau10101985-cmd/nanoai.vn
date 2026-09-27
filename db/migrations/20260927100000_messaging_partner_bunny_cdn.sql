-- Mỗi shop SaaS một Storage Zone + Pull Zone Bunny ({slug}.b-cdn.net).
-- Shop đã tạo chưa có dòng ở bảng này được cron partner-bunny-cdn-provision cấp ổ.
-- Ảnh cũ trên CDN chung giữ URL cũ. Ảnh mới ghi vào ổ shop.

create table if not exists public.messaging_partner_bunny_cdn (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  storage_zone_id bigint not null,
  storage_zone_name text not null,
  storage_password text not null,
  pull_zone_id bigint not null,
  hostname text not null,
  delete_pending boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists messaging_partner_bunny_cdn_hostname_uidx
  on public.messaging_partner_bunny_cdn (hostname);

create unique index if not exists messaging_partner_bunny_cdn_zone_name_uidx
  on public.messaging_partner_bunny_cdn (storage_zone_name);

comment on table public.messaging_partner_bunny_cdn is
  'Ổ CDN Bunny riêng của shop SaaS. storage_password là mật khẩu Storage Zone, không gửi ra client.';
