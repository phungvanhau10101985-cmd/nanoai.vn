-- Guest / synced demographics for 188-style same-age + gender cohort recommendations.
alter table public.messaging_partner_visitor_personalization
  add column if not exists profile_gender text,
  add column if not exists profile_birth_year integer;

comment on column public.messaging_partner_visitor_personalization.profile_gender is
  'male|female hint for same-age/gender cohort (guest hint or synced from profiles after login).';

comment on column public.messaging_partner_visitor_personalization.profile_birth_year is
  'Birth year hint for exact_cohort (same year + gender).';

comment on column public.messaging_partner_visitor_personalization.recently_viewed_ids is
  'JSON array of inventory UUID strings, most recent first (max ~40, 188 same-shop window).';
