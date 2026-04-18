-- JSON service account do từng shop lưu trong cài đặt (không bắt buộc biến môi trường toàn server).
alter table public.messaging_partner_google_sheets_settings
  add column if not exists service_account_json text null;

comment on column public.messaging_partner_google_sheets_settings.service_account_json is
  'Google service account JSON (private). Shop dán trong dashboard; share Sheet với client_email trong JSON.';
