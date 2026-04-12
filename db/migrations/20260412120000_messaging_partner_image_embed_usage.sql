-- Token billable (Gemini embedContent) theo partner: đồng bộ vector kho + tìm ảnh khách.

create table if not exists public.messaging_partner_image_embed_usage (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  source text not null,
  model text not null,
  prompt_tokens int not null default 0,
  total_tokens int not null default 0,
  inventory_id uuid null,
  created_at timestamptz not null default now (),
  constraint messaging_partner_image_embed_usage_source_chk check (
    source in ('inventory_sync', 'guest_image_search')
  )
);

create index if not exists idx_messaging_partner_image_embed_usage_partner_created
  on public.messaging_partner_image_embed_usage (partner_id, created_at desc);

create index if not exists idx_messaging_partner_image_embed_usage_source
  on public.messaging_partner_image_embed_usage (partner_id, source);

comment on table public.messaging_partner_image_embed_usage is
  'Mỗi lần gọi Gemini embedContent (ảnh): token billable; nguồn inventory_sync (đồng bộ kho) hoặc guest_image_search (khách gửi ảnh).';

alter table public.messaging_partner_image_embed_usage enable row level security;

create policy messaging_partner_image_embed_usage_owner_select
  on public.messaging_partner_image_embed_usage
  for select
  using (
    exists (
      select 1
      from public.messaging_partners mp
      where mp.id = messaging_partner_image_embed_usage.partner_id
        and mp.owner_user_id = auth.uid ()
    )
  );
