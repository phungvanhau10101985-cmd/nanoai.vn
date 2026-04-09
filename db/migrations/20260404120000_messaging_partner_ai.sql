-- AI trả lời tự động cho inbox đối tác: FAQ tức thì + job trễ + cron xử lý LLM.

create table if not exists public.messaging_partner_ai_settings (
  partner_id uuid primary key references public.messaging_partners (id) on delete cascade,
  enabled boolean not null default false,
  reply_delay_seconds int not null default 60
    check (reply_delay_seconds >= 15 and reply_delay_seconds <= 900),
  typing_pause_min_ms int not null default 1200
    check (typing_pause_min_ms >= 0 and typing_pause_min_ms <= 30000),
  typing_pause_max_ms int not null default 3800
    check (typing_pause_max_ms >= 0 and typing_pause_max_ms <= 30000),
  shop_policy text not null default '',
  tone_instructions text not null default '',
  append_ai_disclosure boolean not null default true,
  disclosure_suffix text not null default '(Tin nhắn tự động từ trợ lý AI của shop.)',
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partner_ai_settings is 'Cấu hình AI tự động trả lời khách (theo partner).';

create table if not exists public.messaging_partner_faq (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  sort_order int not null default 0,
  trigger_keywords text not null default '',
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists idx_messaging_partner_faq_partner on public.messaging_partner_faq (partner_id);

comment on table public.messaging_partner_faq is 'FAQ: từ khóa kích hoạt (phẩy hoặc xuống dòng) + câu trả lời cố định.';

create table if not exists public.messaging_partner_inventory (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  sort_order int not null default 0,
  sku text,
  name text not null,
  description text not null default '',
  stock_note text not null default '',
  price_hint text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now ()
);

create index if not exists idx_messaging_partner_inventory_partner on public.messaging_partner_inventory (partner_id);

comment on table public.messaging_partner_inventory is 'Gợi ý kho/mẫu để đưa vào ngữ cảnh LLM.';

create table if not exists public.messaging_partner_ai_jobs (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  conversation_id uuid not null references public.customer_care_conversations (id) on delete cascade,
  trigger_message_id uuid not null references public.customer_care_messages (id) on delete cascade,
  run_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'cancelled', 'failed')),
  error text,
  created_at timestamptz not null default now ()
);

create index if not exists idx_messaging_partner_ai_jobs_pending_run
  on public.messaging_partner_ai_jobs (run_at asc)
  where status = 'pending';

comment on table public.messaging_partner_ai_jobs is 'Hàng đợi trả lời AI sau delay; cron hoặc xử lý nền.';

alter table public.messaging_partner_ai_settings enable row level security;
alter table public.messaging_partner_faq enable row level security;
alter table public.messaging_partner_inventory enable row level security;
alter table public.messaging_partner_ai_jobs enable row level security;

-- Chủ partner
create policy messaging_partner_ai_settings_owner_all
  on public.messaging_partner_ai_settings
  for all
  using (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_ai_settings.partner_id and mp.owner_user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_ai_settings.partner_id and mp.owner_user_id = auth.uid ()
    )
  );

create policy messaging_partner_faq_owner_all
  on public.messaging_partner_faq
  for all
  using (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_faq.partner_id and mp.owner_user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_faq.partner_id and mp.owner_user_id = auth.uid ()
    )
  );

create policy messaging_partner_inventory_owner_all
  on public.messaging_partner_inventory
  for all
  using (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_inventory.partner_id and mp.owner_user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners mp
      where mp.id = messaging_partner_inventory.partner_id and mp.owner_user_id = auth.uid ()
    )
  );

-- Jobs: không cho JWT (chỉ service role / cron)
-- RLS enabled, không tạo policy → authenticated không đọc/ghi được.
