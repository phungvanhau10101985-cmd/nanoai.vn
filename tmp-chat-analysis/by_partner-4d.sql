select mp.slug, mp.display_name, c.channel,
  count(*) filter (where m.direction='inbound') as inbound,
  count(*) filter (where m.direction='outbound' and m.sender_admin_id is null) as ai_out,
  count(*) filter (where m.direction='outbound' and m.sender_admin_id is not null) as human_out,
  count(distinct m.conversation_id) as convs
from public.customer_care_messages m
join public.customer_care_conversations c on c.id = m.conversation_id
join public.messaging_partners mp on mp.id = c.partner_id
where m.created_at >= now() - interval '4 days'
group by 1,2,3
order by inbound desc;
