-- Cấu hình ngân hàng / QR nạp credit (trước đây chỉ có trong migrations/create_payments_table.sql cũ).
-- DB chỉ áp db/migrations/ sẽ thiếu bảng → GET /api/payment-configs 500.

create table if not exists public.payment_configs (
  id uuid primary key default gen_random_uuid(),
  bank_account varchar(50) not null,
  bank_id varchar(10) not null,
  bank_name varchar(100) not null,
  account_holder_name text,
  qr_template_url varchar(500) not null default 'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.payment_configs is 'TK nhận + template QR nạp credit (SePay).';
