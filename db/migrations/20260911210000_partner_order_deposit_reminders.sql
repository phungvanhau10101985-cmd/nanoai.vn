-- Additive: timestamps for 2h/20h deposit reminders (188 deposit_sla).
-- Does not auto-cancel China orders.

alter table public.messaging_partner_orders
  add column if not exists deposit_reminded_at_2h timestamptz,
  add column if not exists deposit_reminded_at_20h timestamptz;

comment on column public.messaging_partner_orders.deposit_reminded_at_2h is
  'First unpaid-deposit reminder (2h). VN stock hold still releases at 24h; China is not auto-cancelled.';
comment on column public.messaging_partner_orders.deposit_reminded_at_20h is
  'Second unpaid-deposit reminder (20h).';
