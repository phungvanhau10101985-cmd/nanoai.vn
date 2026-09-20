select now() as now_utc,
  count(*) filter (where m.created_at >= now() - interval ''5 days'') as msgs_5d,
  count(*) filter (where m.created_at >= now() - interval ''5 days'' and m.direction=''inbound'') as inbound_5d,
  count(*) filter (where m.created_at >= now() - interval ''5 days'' and m.direction=''outbound'' and m.sender_admin_id is null) as ai_out_5d,
  count(*) filter (where m.created_at >= now() - interval ''5 days'' and m.direction=''outbound'' and m.sender_admin_id is not null) as human_out_5d
from public.customer_care_messages m;
