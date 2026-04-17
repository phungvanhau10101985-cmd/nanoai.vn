-- GA4 measurement ID (G-...) — gtag config trên trang tư vấn / shop; chủ shop xem Realtime trong GA4
alter table public.messaging_partners
  add column if not exists ga4_measurement_id text null;

comment on column public.messaging_partners.ga4_measurement_id is 'Google Analytics 4 measurement ID (G-...) — gtag config on guest consult page; Realtime in GA4 UI';
