-- Đa tenant B2B2C: đối tác dịch vụ (shop) có inbox riêng; khách cuối nhắn FB/Zalo/widget.
-- Partner mặc định NanoAI (hỗ trợ nội bộ + dữ liệu cũ).

create table if not exists public.messaging_partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  owner_user_id uuid references auth.users (id) on delete set null,
  embed_key uuid not null default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.messaging_partners is 'Đối tác dùng nền tảng nhắn tin tư vấn (B2B); owner_user_id = chủ shop.';

create table if not exists public.messaging_partner_channels (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  provider text not null check (provider in ('facebook_messenger', 'zalo_oa')),
  external_page_id text not null,
  page_access_token text,
  webhook_verify_token text,
  zalo_access_token text,
  zalo_webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Một Page Facebook chỉ gắn một đối tác; mỗi đối tác tối đa một kênh Zalo OA (external_page_id = 'default').
create unique index if not exists idx_messaging_partner_channels_fb_page
  on public.messaging_partner_channels (external_page_id)
  where provider = 'facebook_messenger';

create unique index if not exists idx_messaging_partner_channels_zalo_per_partner
  on public.messaging_partner_channels (partner_id)
  where provider = 'zalo_oa';

create index if not exists idx_messaging_partner_channels_partner on public.messaging_partner_channels (partner_id);

comment on table public.messaging_partner_channels is 'Cấu hình Page FB / OA Zalo theo đối tác; chỉ server (service role) đọc token.';

insert into public.messaging_partners (id, slug, display_name, owner_user_id, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  'nanoai',
  'NanoAI',
  null,
  true
)
on conflict (slug) do nothing;

alter table public.customer_care_conversations
  add column if not exists partner_id uuid references public.messaging_partners (id);

alter table public.customer_care_conversations
  add column if not exists channel_external_ref text;

update public.customer_care_conversations
set partner_id = '11111111-1111-1111-1111-111111111111'
where partner_id is null;

alter table public.customer_care_conversations
  alter column partner_id set not null;

alter table public.customer_care_conversations
  drop constraint if exists customer_care_conversations_channel_external_thread_id_key;

alter table public.customer_care_conversations
  drop constraint if exists customer_care_conversations_channel_check;

alter table public.customer_care_conversations
  add constraint customer_care_conversations_channel_check
  check (channel in ('facebook', 'zalo', 'internal', 'widget'));

alter table public.customer_care_conversations
  add constraint customer_care_conversations_partner_channel_thread unique (partner_id, channel, external_thread_id);

alter table public.customer_care_conversations
  add constraint customer_care_internal_only_platform_partner
  check (channel <> 'internal' or partner_id = '11111111-1111-1111-1111-111111111111');

create index if not exists idx_customer_care_conversations_partner
  on public.customer_care_conversations (partner_id);

alter table public.messaging_partners enable row level security;
alter table public.messaging_partner_channels enable row level security;

create policy messaging_partners_admin_all
  on public.messaging_partners
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy messaging_partners_owner_select
  on public.messaging_partners
  for select
  using (owner_user_id is not null and owner_user_id = auth.uid());

create policy messaging_partners_owner_update
  on public.messaging_partners
  for update
  using (owner_user_id is not null and owner_user_id = auth.uid())
  with check (owner_user_id is not null and owner_user_id = auth.uid());

create policy messaging_partners_owner_insert
  on public.messaging_partners
  for insert
  with check (owner_user_id = auth.uid());

-- Không grant SELECT JWT cho bảng chứa token — chỉ service role (bypass RLS).

drop policy if exists customer_care_conversations_user_internal_select on public.customer_care_conversations;
drop policy if exists customer_care_conversations_user_internal_insert on public.customer_care_conversations;
drop policy if exists customer_care_messages_user_internal_select on public.customer_care_messages;
drop policy if exists customer_care_messages_user_internal_insert_inbound on public.customer_care_messages;

create policy customer_care_conversations_user_internal_select
  on public.customer_care_conversations
  for select
  using (
    channel = 'internal'
    and partner_id = '11111111-1111-1111-1111-111111111111'
    and linked_user_id = auth.uid()
  );

create policy customer_care_conversations_user_internal_insert
  on public.customer_care_conversations
  for insert
  with check (
    channel = 'internal'
    and partner_id = '11111111-1111-1111-1111-111111111111'
    and linked_user_id = auth.uid()
    and external_thread_id = auth.uid()::text
  );

create policy customer_care_messages_user_internal_select
  on public.customer_care_messages
  for select
  using (
    exists (
      select 1
      from public.customer_care_conversations c
      where c.id = customer_care_messages.conversation_id
        and c.channel = 'internal'
        and c.partner_id = '11111111-1111-1111-1111-111111111111'
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
        and c.partner_id = '11111111-1111-1111-1111-111111111111'
        and c.linked_user_id = auth.uid()
    )
  );

-- Chủ đối tác: toàn quyền hội thoại / tin của partner_id thuộc mình
create policy customer_care_conversations_partner_owner_all
  on public.customer_care_conversations
  for all
  using (
    exists (
      select 1
      from public.messaging_partners mp
      where mp.id = customer_care_conversations.partner_id
        and mp.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.messaging_partners mp
      where mp.id = customer_care_conversations.partner_id
        and mp.owner_user_id = auth.uid()
    )
  );

create policy customer_care_messages_partner_owner_all
  on public.customer_care_messages
  for all
  using (
    exists (
      select 1
      from public.customer_care_conversations c
      join public.messaging_partners mp on mp.id = c.partner_id
      where c.id = customer_care_messages.conversation_id
        and mp.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.customer_care_conversations c
      join public.messaging_partners mp on mp.id = c.partner_id
      where c.id = customer_care_messages.conversation_id
        and mp.owner_user_id = auth.uid()
    )
  );
