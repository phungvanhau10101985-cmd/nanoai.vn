-- Singleton: Secret Key HMAC webhook SePay (dashboard HMAC-SHA256, whsec_...).
-- Admin điền tại /admin/payment-config. Webhook đọc DB rồi fallback env.

create table if not exists public.sepay_webhook_settings (
  id smallint primary key default 1,
  hmac_secret text,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint sepay_webhook_settings_singleton check (id = 1)
);

comment on table public.sepay_webhook_settings is 'Secret HMAC webhook SePay (whsec_); một dòng. Admin /admin/payment-config.';

insert into public.sepay_webhook_settings (id, hmac_secret)
values (1, null)
on conflict (id) do nothing;
