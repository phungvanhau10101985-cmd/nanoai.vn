-- Google Customer Reviews merchant id — popup khảo sát sau COD / sau đặt cọc (mọi shop)
alter table public.messaging_partners
  add column if not exists google_customer_reviews_merchant_id integer null;

comment on column public.messaging_partners.google_customer_reviews_merchant_id is
  'Google Merchant Center numeric ID — Customer Reviews surveyoptin after checkout/deposit';
