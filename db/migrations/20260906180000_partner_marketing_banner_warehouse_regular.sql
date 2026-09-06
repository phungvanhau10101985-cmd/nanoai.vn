-- Additive: warehouse (sale kho) + regular (banner thường) 21:9 assets.
-- Existing sale/birthday rows stay. Check constraint replaced in place.

alter table public.messaging_partner_marketing_banner_assets
  drop constraint if exists messaging_partner_marketing_banner_assets_kind_check;

alter table public.messaging_partner_marketing_banner_assets
  add constraint messaging_partner_marketing_banner_assets_kind_check
  check (kind in ('sale', 'birthday', 'warehouse', 'regular'));
