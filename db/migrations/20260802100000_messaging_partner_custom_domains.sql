-- Custom domain (white-label) per messaging partner workspace — chat + shop on customer hostname with SSL via platform proxy.
create table if not exists public.messaging_partner_custom_domains (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid not null references public.messaging_partners(id) on delete cascade,
  hostname text not null,
  verification_token text not null,
  dns_verified_at timestamp with time zone null,
  ssl_status text not null default 'pending'
    check (ssl_status in ('pending', 'dns_ok', 'ssl_active', 'error')),
  ssl_provisioned_at timestamp with time zone null,
  ssl_last_error text null,
  use_for_chat boolean not null default true,
  use_for_site boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint messaging_partner_custom_domains_hostname_unique unique (hostname),
  constraint messaging_partner_custom_domains_partner_unique unique (partner_id)
);

create index if not exists idx_messaging_partner_custom_domains_hostname
  on public.messaging_partner_custom_domains (lower(hostname));

create index if not exists idx_messaging_partner_custom_domains_partner
  on public.messaging_partner_custom_domains (partner_id);

alter table public.messaging_partner_custom_domains enable row level security;

drop policy if exists "Partner custom domain owners manage own rows." on public.messaging_partner_custom_domains;
create policy "Partner custom domain owners manage own rows." on public.messaging_partner_custom_domains
  for all using (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_custom_domains.partner_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messaging_partners p
      where p.id = messaging_partner_custom_domains.partner_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Verified custom domains are public read." on public.messaging_partner_custom_domains;
create policy "Verified custom domains are public read." on public.messaging_partner_custom_domains
  for select using (dns_verified_at is not null and ssl_status = 'ssl_active');
