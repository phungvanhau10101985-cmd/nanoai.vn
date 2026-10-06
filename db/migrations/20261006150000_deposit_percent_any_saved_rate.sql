-- Cọc theo % đã lưu (0–100). Bỏ check cũ chỉ cho 30 hoặc 100, rồi gắn lại khoảng 0–100.

do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'c'
      and n.nspname = 'public'
      and t.relname in ('messaging_partner_orders', 'messaging_partner_payment_settings')
      and pg_get_constraintdef(c.oid) ilike '%deposit_percent%'
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end $$;

alter table if exists public.messaging_partner_orders
  add constraint messaging_partner_orders_deposit_percent_range_check
  check (deposit_percent >= 0 and deposit_percent <= 100);

alter table if exists public.messaging_partner_payment_settings
  add constraint messaging_partner_payment_settings_default_deposit_percent_range_check
  check (default_deposit_percent >= 0 and default_deposit_percent <= 100);
