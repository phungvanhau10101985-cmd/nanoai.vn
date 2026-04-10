-- Chat ordering + payment proof flow for messaging partner guest chat.

create table if not exists public.messaging_partner_payment_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  bank_name text not null default '',
  bank_bin text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  default_deposit_percent int not null default 30 check (default_deposit_percent in (30, 100)),
  notify_email text not null default '',
  require_payment_proof boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.messaging_partner_orders (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  conversation_id uuid not null references public.customer_care_conversations (id) on delete cascade,
  external_thread_id text not null default '',
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'payment_checking', 'paid_verified', 'pending_manual_review', 'cancelled')),
  customer_name text not null default '',
  customer_email text not null default '',
  customer_phone text not null default '',
  shipping_address text not null default '',
  variant_color text not null default '',
  variant_size text not null default '',
  quantity int not null default 1 check (quantity > 0 and quantity <= 99),
  note text not null default '',
  product_inventory_id uuid null references public.messaging_partner_inventory (id) on delete set null,
  product_name text not null default '',
  product_image_url text not null default '',
  product_url text not null default '',
  unit_price numeric(14, 2) not null default 0,
  subtotal_amount numeric(14, 2) not null default 0,
  deposit_percent int not null default 30 check (deposit_percent in (30, 100)),
  required_amount numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0,
  currency text not null default 'VND',
  payment_reference text not null default '',
  payment_qr_url text not null default '',
  verified_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz null
);

create index if not exists idx_messaging_partner_orders_partner_created
  on public.messaging_partner_orders (partner_id, created_at desc);

create index if not exists idx_messaging_partner_orders_conv_created
  on public.messaging_partner_orders (conversation_id, created_at desc);

create table if not exists public.messaging_partner_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.messaging_partner_orders (id) on delete cascade,
  image_storage_path text not null default '',
  image_url text not null default '',
  ocr_text text not null default '',
  ocr_receiver_account text not null default '',
  ocr_amount numeric(14, 2) null,
  ocr_transaction_ref text not null default '',
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed', 'manual_review')),
  verification_reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_messaging_partner_payment_proofs_order_created
  on public.messaging_partner_payment_proofs (order_id, created_at desc);
