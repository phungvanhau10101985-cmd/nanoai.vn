-- Cho phép liên kết guest account qua đăng nhập web đối tác (token HMAC embed_key).

alter table public.messaging_guest_identities
  drop constraint if exists messaging_guest_identities_provider_check;

alter table public.messaging_guest_identities
  add constraint messaging_guest_identities_provider_check
  check (provider in ('google', 'email_otp', 'partner_site'));

comment on constraint messaging_guest_identities_provider_check on public.messaging_guest_identities is
  'google | email_otp | partner_site (SSO từ web shop đối tác, đồng bộ theo email).';
