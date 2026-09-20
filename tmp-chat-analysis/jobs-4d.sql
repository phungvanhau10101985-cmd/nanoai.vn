select status, count(*) as n
from public.messaging_partner_ai_jobs
where created_at >= now() - interval '4 days'
group by 1 order by n desc;
