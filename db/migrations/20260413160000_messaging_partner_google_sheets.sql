-- Per-shop Google Sheets sync for messaging partner orders (server uses GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON).
create table if not exists public.messaging_partner_google_sheets_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default false,
  spreadsheet_id text not null default '',
  sheet_name text not null default 'Don hang',
  updated_at timestamptz not null default now()
);

alter table public.messaging_partner_orders
  add column if not exists google_sheet_row integer null;

comment on column public.messaging_partner_orders.google_sheet_row is
  '1-based row index in the partner Google Sheet tab for this order (append/update).';
