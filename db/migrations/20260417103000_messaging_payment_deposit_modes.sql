-- Flexible deposit settings:
-- - none: no deposit
-- - percent: custom percent of order value
-- - fixed_amount: fixed VND amount

alter table if exists public.messaging_partner_payment_settings
  add column if not exists default_deposit_mode text not null default 'percent';

alter table if exists public.messaging_partner_payment_settings
  add column if not exists default_deposit_amount numeric(14, 2) not null default 0;

alter table if exists public.messaging_partner_payment_settings
  drop constraint if exists messaging_partner_payment_settings_default_deposit_percent_check;

alter table if exists public.messaging_partner_payment_settings
  add constraint messaging_partner_payment_settings_default_deposit_percent_range_check
  check (default_deposit_percent >= 0 and default_deposit_percent <= 100);

alter table if exists public.messaging_partner_payment_settings
  drop constraint if exists messaging_partner_payment_settings_default_deposit_mode_check;

alter table if exists public.messaging_partner_payment_settings
  add constraint messaging_partner_payment_settings_default_deposit_mode_check
  check (default_deposit_mode in ('none', 'percent', 'fixed_amount'));

alter table if exists public.messaging_partner_payment_settings
  drop constraint if exists messaging_partner_payment_settings_default_deposit_amount_check;

alter table if exists public.messaging_partner_payment_settings
  add constraint messaging_partner_payment_settings_default_deposit_amount_check
  check (default_deposit_amount >= 0);

alter table if exists public.messaging_partner_orders
  drop constraint if exists messaging_partner_orders_deposit_percent_check;

alter table if exists public.messaging_partner_orders
  add constraint messaging_partner_orders_deposit_percent_range_check
  check (deposit_percent >= 0 and deposit_percent <= 100);

