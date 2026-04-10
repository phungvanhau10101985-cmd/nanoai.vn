-- Optional SePay config per messaging workspace (partner-level).

alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_enabled boolean not null default false;

alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_bank_code text not null default '';

alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_account_number text not null default '';

alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_qr_template text not null default 'compact';

alter table if exists public.messaging_partner_payment_settings
  add column if not exists sepay_webhook_token text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messaging_partner_payment_settings_sepay_qr_template_check'
  ) then
    alter table public.messaging_partner_payment_settings
      add constraint messaging_partner_payment_settings_sepay_qr_template_check
      check (sepay_qr_template in ('', 'compact', 'qronly'));
  end if;
end $$;
