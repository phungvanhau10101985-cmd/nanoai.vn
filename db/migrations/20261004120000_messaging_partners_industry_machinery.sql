-- Add industry_key machinery (cơ khí máy móc) alongside fashion / hotel / food / other.

alter table public.messaging_partners
  drop constraint if exists messaging_partners_industry_key_check;

alter table public.messaging_partners
  add constraint messaging_partners_industry_key_check
  check (
    industry_key is null
    or industry_key in ('fashion', 'hotel', 'food', 'machinery', 'other')
  );

comment on column public.messaging_partners.industry_key is
  'Industry profile key: fashion, hotel, food, machinery (cơ khí máy móc), other.';
