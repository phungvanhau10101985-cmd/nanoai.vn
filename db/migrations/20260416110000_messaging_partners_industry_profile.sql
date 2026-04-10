-- Industry-specific workspace profile for partner messaging.
-- Keep nullable first so existing restored databases can migrate safely.

alter table public.messaging_partners
  add column if not exists industry_key text,
  add column if not exists brand_name text,
  add column if not exists logo_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messaging_partners_industry_key_check'
  ) then
    alter table public.messaging_partners
      add constraint messaging_partners_industry_key_check
      check (
        industry_key is null
        or industry_key in ('fashion', 'hotel', 'food', 'other')
      );
  end if;
end$$;

comment on column public.messaging_partners.industry_key is 'Industry profile key used to isolate chat features by vertical.';
comment on column public.messaging_partners.brand_name is 'Brand display name shown in guest widget header.';
comment on column public.messaging_partners.logo_url is 'Optional brand logo URL shown in guest widget.';
