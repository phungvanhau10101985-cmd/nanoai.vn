-- Dedicated settings table for admin integrations (GA/GTM, verification tags, embed codes).
-- Keep separate from legacy runtime settings that were removed.

begin;

create table if not exists public.admin_integrations_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.admin_integrations_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_integrations_settings'
      and policyname = 'Authenticated users can read admin integrations settings'
  ) then
    create policy "Authenticated users can read admin integrations settings"
      on public.admin_integrations_settings
      for select
      using (auth.uid() is not null);
  end if;
end $$;

comment on table public.admin_integrations_settings is
  'Admin integrations settings: analytics, domain verification, and embed codes.';

commit;

