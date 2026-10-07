-- Google Merchant Center IDs are often above int4 max (2147483647), e.g. 5860214669.
alter table public.messaging_partners
  alter column google_customer_reviews_merchant_id type bigint
  using google_customer_reviews_merchant_id::bigint;
