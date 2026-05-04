alter table public.messaging_partner_product_consult_cache
  add column if not exists cache_scope text not null default 'legacy_threaded',
  add column if not exists cache_version text not null default 'v1';

alter table public.messaging_partner_product_consult_cache
  drop constraint if exists messaging_partner_product_consult_cache_scope_chk;

alter table public.messaging_partner_product_consult_cache
  add constraint messaging_partner_product_consult_cache_scope_chk
  check (cache_scope in ('legacy_threaded', 'sku_isolated'));

alter table public.messaging_partner_product_consult_cache
  drop constraint if exists messaging_partner_product_consult_cache_version_chk;

alter table public.messaging_partner_product_consult_cache
  add constraint messaging_partner_product_consult_cache_version_chk
  check (char_length(cache_version) between 1 and 24);

drop index if exists public.uq_messaging_partner_product_consult_cache_key;

create unique index if not exists uq_messaging_partner_product_consult_cache_scoped_key
  on public.messaging_partner_product_consult_cache (
    partner_id,
    inventory_id,
    gender,
    ui_locale,
    cache_scope,
    cache_version
  );

comment on column public.messaging_partner_product_consult_cache.cache_scope is
  'Cache scope. sku_isolated is safe for product_card_consult because it must not depend on thread history.';

comment on column public.messaging_partner_product_consult_cache.cache_version is
  'Cache version for invalidating old prompt/output shapes.';

