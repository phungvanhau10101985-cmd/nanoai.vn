alter table public.nanoai_email_trusted_devices
  add column if not exists browser_id_hash text;

create index if not exists idx_nanoai_email_trusted_devices_browser
  on public.nanoai_email_trusted_devices (email_normalized, browser_id_hash)
  where browser_id_hash is not null;
