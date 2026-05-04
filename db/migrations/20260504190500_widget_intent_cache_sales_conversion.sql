alter table public.messaging_partner_widget_intent_cache
  add column if not exists sales_stage text,
  add column if not exists cta_strategy text,
  add column if not exists category text,
  add column if not exists reason text;

alter table public.messaging_partner_widget_intent_cache
  drop constraint if exists messaging_partner_widget_intent_cache_sales_stage_check;

alter table public.messaging_partner_widget_intent_cache
  add constraint messaging_partner_widget_intent_cache_sales_stage_check
  check (
    sales_stage is null or sales_stage in (
      'browsing',
      'considering',
      'objection',
      'purchase_ready',
      'post_purchase_support'
    )
  );

alter table public.messaging_partner_widget_intent_cache
  drop constraint if exists messaging_partner_widget_intent_cache_cta_strategy_check;

alter table public.messaging_partner_widget_intent_cache
  add constraint messaging_partner_widget_intent_cache_cta_strategy_check
  check (
    cta_strategy is null or cta_strategy in (
      'soft_explore',
      'fit_question',
      'reassure_then_cta',
      'buy_now',
      'no_cta'
    )
  );

comment on column public.messaging_partner_widget_intent_cache.sales_stage is
  'Sales stage from widget intent classifier v3.';

comment on column public.messaging_partner_widget_intent_cache.cta_strategy is
  'CTA strategy from widget intent classifier v3.';

