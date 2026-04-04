-- Thống kê token API LLM (theo partner / model) cho shop theo dõi chi phí.

create table if not exists public.messaging_partner_ai_token_usage (
  id uuid primary key default gen_random_uuid (),
  partner_id uuid not null references public.messaging_partners (id) on delete cascade,
  provider text not null default 'deepseek',
  model text not null,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  conversation_id uuid references public.customer_care_conversations (id) on delete set null,
  ai_job_id uuid references public.messaging_partner_ai_jobs (id) on delete set null,
  created_at timestamptz not null default now ()
);

create index if not exists idx_messaging_partner_ai_token_usage_partner_created
  on public.messaging_partner_ai_token_usage (partner_id, created_at desc);

create index if not exists idx_messaging_partner_ai_token_usage_partner_model
  on public.messaging_partner_ai_token_usage (partner_id, model);

comment on table public.messaging_partner_ai_token_usage is 'Mỗi lần gọi chat completion LLM (inbox shop): token theo model; shop xem tổng hợp trên dashboard.';

alter table public.messaging_partner_ai_token_usage enable row level security;

create policy messaging_partner_ai_token_usage_owner_select
  on public.messaging_partner_ai_token_usage
  for select
  using (
    exists (
      select 1
      from public.messaging_partners mp
      where mp.id = messaging_partner_ai_token_usage.partner_id
        and mp.owner_user_id = auth.uid ()
    )
  );

-- Ghi chỉ từ server (service role); JWT không insert/update/delete.

create or replace function public.messaging_partner_ai_token_stats_by_model (
  p_partner_id uuid,
  p_since timestamptz
)
returns table (
  provider text,
  model text,
  call_count bigint,
  sum_prompt_tokens bigint,
  sum_completion_tokens bigint,
  sum_total_tokens bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    u.provider,
    u.model,
    count(*)::bigint as call_count,
    coalesce(sum(u.prompt_tokens), 0)::bigint as sum_prompt_tokens,
    coalesce(sum(u.completion_tokens), 0)::bigint as sum_completion_tokens,
    coalesce(sum(u.total_tokens), 0)::bigint as sum_total_tokens
  from public.messaging_partner_ai_token_usage u
  where u.partner_id = p_partner_id
    and u.created_at >= coalesce(p_since, '-infinity'::timestamptz)
  group by u.provider, u.model
  order by sum_total_tokens desc nulls last, u.model asc;
$$;

comment on function public.messaging_partner_ai_token_stats_by_model (uuid, timestamptz) is
  'Tổng token & số lần gọi theo provider+model trong khoảng thời gian (RLS theo chủ partner).';

grant execute on function public.messaging_partner_ai_token_stats_by_model (uuid, timestamptz) to authenticated;
