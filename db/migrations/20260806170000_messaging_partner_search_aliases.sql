-- M3.4 — keyword → product/category aliases for storefront search.
create table if not exists public.messaging_partner_search_aliases (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  keyword text not null,
  inventory_id uuid null references public.messaging_partner_inventory(id) on delete cascade,
  category_id uuid null references public.messaging_partner_categories(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint messaging_partner_search_aliases_target_chk
    check (inventory_id is not null or category_id is not null)
);

create unique index if not exists messaging_partner_search_aliases_keyword_uidx
  on public.messaging_partner_search_aliases (partner_id, lower(keyword));

create index if not exists messaging_partner_search_aliases_partner_idx
  on public.messaging_partner_search_aliases (partner_id);
