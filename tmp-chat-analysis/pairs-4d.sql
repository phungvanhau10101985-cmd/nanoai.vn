copy (
select
  c.id::text as conversation_id,
  mp.slug,
  mp.display_name as shop,
  c.channel,
  left(coalesce(c.customer_name,''), 40) as customer_name,
  i.id::text as inbound_id,
  to_char(i.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS') as inbound_at,
  left(regexp_replace(i.body, E'[\\n\\r]+', ' | ', 'g'), 1500) as inbound_body,
  left(coalesce(i.landing_source_url,''), 200) as landing_source_url,
  coalesce(i.raw_payload->'page_context'->>'sku', i.raw_payload->>'sku') as page_sku,
  coalesce(i.raw_payload->'page_context'->>'inventory_id', '') as page_inventory_id,
  (i.raw_payload ? 'guest_media' or i.body ilike '%[Customer image:%') as has_image,
  o.id::text as outbound_id,
  to_char(o.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS') as outbound_at,
  case when o.created_at is null then null else extract(epoch from (o.created_at - i.created_at))::int end as reply_lag_sec,
  (o.sender_admin_id is not null) as human_reply,
  left(regexp_replace(coalesce(o.body,''), E'[\\n\\r]+', ' | ', 'g'), 1800) as outbound_body,
  coalesce(o.raw_payload->>'partner_ai_route_intent','') as route_intent,
  coalesce(o.raw_payload->>'partner_ai_pipeline_branch','') as pipeline_branch,
  coalesce(o.raw_payload->>'partner_ai_sales_stage','') as sales_stage,
  coalesce(jsonb_array_length(o.raw_payload->'ai_product_cards'), 0) as card_count,
  (
    select string_agg(coalesce(card->>'name', card->>'sku'), ' | ')
    from jsonb_array_elements(coalesce(o.raw_payload->'ai_product_cards', '[]'::jsonb)) card
  ) as card_names,
  left(regexp_replace(coalesce(n.body,''), E'[\\n\\r]+', ' | ', 'g'), 800) as next_inbound_body,
  (h.id is not null) as human_after_ai,
  left(regexp_replace(coalesce(h.body,''), E'[\\n\\r]+', ' | ', 'g'), 400) as human_after_ai_body
from public.customer_care_messages i
join public.customer_care_conversations c on c.id = i.conversation_id
join public.messaging_partners mp on mp.id = c.partner_id
left join public.v_bot_suspected_conversations bot on bot.conversation_id = c.id
left join lateral (
  select o.*
  from public.customer_care_messages o
  where o.conversation_id = i.conversation_id
    and o.direction = 'outbound'
    and o.created_at > i.created_at
    and o.created_at <= i.created_at + interval '20 minutes'
  order by o.created_at
  limit 1
) o on true
left join lateral (
  select n.*
  from public.customer_care_messages n
  where n.conversation_id = i.conversation_id
    and n.direction = 'inbound'
    and n.created_at > coalesce(o.created_at, i.created_at)
    and n.created_at <= i.created_at + interval '6 hours'
  order by n.created_at
  limit 1
) n on true
left join lateral (
  select hm.*
  from public.customer_care_messages hm
  where hm.conversation_id = i.conversation_id
    and hm.direction = 'outbound'
    and hm.sender_admin_id is not null
    and o.id is not null
    and o.sender_admin_id is null
    and hm.created_at > o.created_at
    and hm.created_at <= o.created_at + interval '45 minutes'
  order by hm.created_at
  limit 1
) h on true
where i.direction = 'inbound'
  and i.created_at >= now() - interval '4 days'
  and coalesce(i.body, '') !~* '^\s*$'
  and bot.conversation_id is null
order by i.created_at desc
) to stdout with csv header
