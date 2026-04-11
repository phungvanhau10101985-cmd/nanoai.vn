-- Add per-shop SePay secret key (used to verify webhook signature by shop).
alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_secret_key text not null default '';

