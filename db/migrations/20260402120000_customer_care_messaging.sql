-- Hội thoại chăm sóc khách hàng: Facebook Messenger, Zalo OA, hoặc chat nội bộ (NanoAI).
create table if not exists public.customer_care_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('facebook', 'zalo', 'internal')),
  external_thread_id text not null,
  linked_user_id uuid references auth.users (id) on delete set null,
  customer_name text,
  customer_avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'archived')),
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_thread_id)
);

create index if not exists idx_customer_care_conversations_last_at
  on public.customer_care_conversations (last_message_at desc nulls last);

create index if not exists idx_customer_care_conversations_channel
  on public.customer_care_conversations (channel);

create table if not exists public.customer_care_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_care_conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  raw_payload jsonb,
  sender_admin_id uuid references auth.users (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_care_messages_conversation_created
  on public.customer_care_messages (conversation_id, created_at asc);

comment on table public.customer_care_conversations is 'Đa kênh CSKH: facebook (PSID), zalo (user_id), internal (user id nền tảng).';
comment on table public.customer_care_messages is 'Tin nhắn inbound (khách) / outbound (admin hoặc hệ thống).';

-- Cập nhật preview khi có tin mới
create or replace function public.customer_care_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customer_care_conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 240),
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_customer_care_message_touch on public.customer_care_messages;
create trigger trg_customer_care_message_touch
  after insert on public.customer_care_messages
  for each row
  execute function public.customer_care_touch_conversation();

alter table public.customer_care_conversations enable row level security;
alter table public.customer_care_messages enable row level security;

-- Admin: toàn quyền
create policy customer_care_conversations_admin_all
  on public.customer_care_conversations
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy customer_care_messages_admin_all
  on public.customer_care_messages
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- User: hội thoại internal của chính mình
create policy customer_care_conversations_user_internal_select
  on public.customer_care_conversations
  for select
  using (channel = 'internal' and linked_user_id = auth.uid());

create policy customer_care_conversations_user_internal_insert
  on public.customer_care_conversations
  for insert
  with check (
    channel = 'internal'
    and linked_user_id = auth.uid()
    and external_thread_id = auth.uid()::text
  );

-- User: chỉ xem / gửi tin trong hội thoại internal của mình
create policy customer_care_messages_user_internal_select
  on public.customer_care_messages
  for select
  using (
    exists (
      select 1
      from public.customer_care_conversations c
      where c.id = customer_care_messages.conversation_id
        and c.channel = 'internal'
        and c.linked_user_id = auth.uid()
    )
  );

create policy customer_care_messages_user_internal_insert_inbound
  on public.customer_care_messages
  for insert
  with check (
    direction = 'inbound'
    and sender_admin_id is null
    and exists (
      select 1
      from public.customer_care_conversations c
      where c.id = conversation_id
        and c.channel = 'internal'
        and c.linked_user_id = auth.uid()
    )
  );
