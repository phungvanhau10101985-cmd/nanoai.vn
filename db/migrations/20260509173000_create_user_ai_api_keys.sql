begin;

create table if not exists public.user_ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  key_hint text not null default '',
  is_enabled boolean not null default true,
  status text not null default 'unchecked',
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_ai_api_keys_provider_check check (provider in ('google_gemini')),
  constraint user_ai_api_keys_status_check check (status in ('unchecked', 'valid', 'invalid')),
  constraint user_ai_api_keys_unique_user_provider unique (user_id, provider)
);

create index if not exists idx_user_ai_api_keys_user_id
  on public.user_ai_api_keys (user_id);

alter table public.user_ai_api_keys enable row level security;

drop policy if exists "user_ai_api_keys_select_own" on public.user_ai_api_keys;
create policy "user_ai_api_keys_select_own"
  on public.user_ai_api_keys
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_ai_api_keys_insert_own" on public.user_ai_api_keys;
create policy "user_ai_api_keys_insert_own"
  on public.user_ai_api_keys
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_ai_api_keys_update_own" on public.user_ai_api_keys;
create policy "user_ai_api_keys_update_own"
  on public.user_ai_api_keys
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_ai_api_keys_delete_own" on public.user_ai_api_keys;
create policy "user_ai_api_keys_delete_own"
  on public.user_ai_api_keys
  for delete
  using (auth.uid() = user_id);

create or replace function public.trg_user_ai_api_keys_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_ai_api_keys_set_updated_at on public.user_ai_api_keys;
create trigger trg_user_ai_api_keys_set_updated_at
  before update on public.user_ai_api_keys
  for each row
  execute procedure public.trg_user_ai_api_keys_set_updated_at();

comment on table public.user_ai_api_keys is
  'Per-user encrypted BYOK provider API keys. Secret plaintext is never stored.';

commit;
