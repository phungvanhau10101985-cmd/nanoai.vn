-- Conversation traffic quality views:
-- - v_customer_care_conversation_traffic_quality: base stats + heuristic label
-- - v_bot_suspected_conversations: likely crawler/prefetch/bot traffic
-- - v_human_conversations: likely real customer conversations for sales

create or replace view public.v_customer_care_conversation_traffic_quality as
with ranked_inbound as (
  select
    m.conversation_id,
    m.created_at,
    m.body,
    m.landing_source_url,
    row_number() over (partition by m.conversation_id order by m.created_at asc, m.id asc) as rn
  from public.customer_care_messages m
  where m.direction = 'inbound'
),
inbound_pivots as (
  select
    r.conversation_id,
    max(case when r.rn = 1 then r.created_at end) as first_inbound_at,
    max(case when r.rn = 2 then r.created_at end) as second_inbound_at,
    max(case when r.rn = 1 then r.body end) as first_inbound_body,
    max(case when r.rn = 1 then r.landing_source_url end) as first_landing_source_url
  from ranked_inbound r
  group by r.conversation_id
),
message_counts as (
  select
    m.conversation_id,
    count(*) filter (where m.direction = 'inbound') as inbound_count,
    count(*) filter (where m.direction = 'outbound') as outbound_count
  from public.customer_care_messages m
  group by m.conversation_id
)
select
  c.id as conversation_id,
  c.partner_id,
  mp.slug as partner_slug,
  mp.display_name as partner_display_name,
  c.channel,
  c.external_thread_id,
  c.customer_name,
  c.created_at as conversation_created_at,
  coalesce(mc.inbound_count, 0) as inbound_count,
  coalesce(mc.outbound_count, 0) as outbound_count,
  ip.first_inbound_at,
  ip.second_inbound_at,
  ip.first_inbound_body,
  ip.first_landing_source_url,
  case
    when ip.first_inbound_at is not null and ip.second_inbound_at is not null
      then greatest(
        0,
        floor(extract(epoch from (ip.second_inbound_at - ip.first_inbound_at)))
      )::int
    else null
  end as seconds_to_second_inbound,
  case
    when coalesce(mc.inbound_count, 0) = 1 then 'single_inbound_only'
    when coalesce(mc.inbound_count, 0) = 2
      and coalesce(mc.outbound_count, 0) = 0
      and ip.first_inbound_at is not null
      and ip.second_inbound_at is not null
      and ip.second_inbound_at - ip.first_inbound_at < interval '10 seconds'
      then 'double_inbound_under_10s_without_outbound'
    else null
  end as suspected_reason
from public.customer_care_conversations c
left join public.messaging_partners mp on mp.id = c.partner_id
left join message_counts mc on mc.conversation_id = c.id
left join inbound_pivots ip on ip.conversation_id = c.id;

create or replace view public.v_bot_suspected_conversations as
select *
from public.v_customer_care_conversation_traffic_quality
where suspected_reason is not null;

create or replace view public.v_human_conversations as
select *
from public.v_customer_care_conversation_traffic_quality
where inbound_count >= 2
  and suspected_reason is null;

comment on view public.v_customer_care_conversation_traffic_quality is
  'Base quality signals for customer-care conversations; includes simple suspected-bot heuristics.';

comment on view public.v_bot_suspected_conversations is
  'Conversations likely from crawler/prefetch/bot traffic based on inbound-only heuristics.';

comment on view public.v_human_conversations is
  'Likely real conversations (>=2 inbound messages, excluding suspected-bot heuristics).';
