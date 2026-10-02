-- Count sale-icon AI attempts so cron stops after 3 failed saves.

alter table public.messaging_partner_sale_icons
  add column if not exists attempt_count integer not null default 0;

comment on column public.messaging_partner_sale_icons.attempt_count is
  'Số lần cron/AI đã bắt đầu vẽ icon sale cho đúng ngày. Dừng ở 3 nếu chưa lưu được.';
