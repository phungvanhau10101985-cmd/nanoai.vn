select now() at time zone 'Asia/Ho_Chi_Minh' as now_ict,
  count(*) filter (where m.created_at >= now() - interval '4 days') as msgs_4d,
  count(*) filter (where m.created_at >= now() - interval '4 days' and m.direction='inbound') as inbound_4d,
  count(*) filter (where m.created_at >= now() - interval '4 days' and m.direction='outbound' and m.sender_admin_id is null) as ai_out_4d,
  count(*) filter (where m.created_at >= now() - interval '4 days' and m.direction='outbound' and m.sender_admin_id is not null) as human_out_4d,
  count(distinct m.conversation_id) filter (where m.created_at >= now() - interval '4 days') as convs_4d
from public.customer_care_messages m;
