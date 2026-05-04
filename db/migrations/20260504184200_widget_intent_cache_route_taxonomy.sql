alter table public.messaging_partner_widget_intent_cache
  drop constraint if exists messaging_partner_widget_intent_cache_decision_check;

alter table public.messaging_partner_widget_intent_cache
  add constraint messaging_partner_widget_intent_cache_decision_check
  check (
    decision in (
      'context_reply',
      'clarify',
      'product_search',
      'card_consult_isolated',
      'explicit_sku_consult',
      'follow_up_current_product',
      'new_product_search',
      'similar_alternatives',
      'purchase_or_order',
      'policy_or_order_support',
      'pause_or_close'
    )
  );

comment on table public.messaging_partner_widget_intent_cache is
  'Cache phân loại ý định tin widget (legacy 3-way + route taxonomy v3). Khóa = SHA-256(version + partner + khách + ngữ cảnh shop).';

