create table if not exists public.language_coach_cache_daily_stats (
  stat_date date primary key,
  tts_hit integer not null default 0,
  tts_miss integer not null default 0,
  word_hit integer not null default 0,
  word_miss integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.increment_language_coach_cache_stat(
  p_metric text,
  p_inc integer default 1,
  p_day date default current_date
)
returns void
language plpgsql
security definer
as $$
begin
  if p_metric not in ('tts_hit', 'tts_miss', 'word_hit', 'word_miss') then
    return;
  end if;

  insert into public.language_coach_cache_daily_stats (
    stat_date,
    tts_hit,
    tts_miss,
    word_hit,
    word_miss,
    updated_at
  )
  values (
    p_day,
    case when p_metric = 'tts_hit' then greatest(p_inc, 1) else 0 end,
    case when p_metric = 'tts_miss' then greatest(p_inc, 1) else 0 end,
    case when p_metric = 'word_hit' then greatest(p_inc, 1) else 0 end,
    case when p_metric = 'word_miss' then greatest(p_inc, 1) else 0 end,
    now()
  )
  on conflict (stat_date)
  do update set
    tts_hit = public.language_coach_cache_daily_stats.tts_hit
      + case when p_metric = 'tts_hit' then greatest(p_inc, 1) else 0 end,
    tts_miss = public.language_coach_cache_daily_stats.tts_miss
      + case when p_metric = 'tts_miss' then greatest(p_inc, 1) else 0 end,
    word_hit = public.language_coach_cache_daily_stats.word_hit
      + case when p_metric = 'word_hit' then greatest(p_inc, 1) else 0 end,
    word_miss = public.language_coach_cache_daily_stats.word_miss
      + case when p_metric = 'word_miss' then greatest(p_inc, 1) else 0 end,
    updated_at = now();
end;
$$;

grant execute on function public.increment_language_coach_cache_stat(text, integer, date) to anon, authenticated, service_role;

alter table public.language_coach_cache_daily_stats enable row level security;

drop policy if exists "language_coach_cache_daily_stats_select_all_auth" on public.language_coach_cache_daily_stats;
create policy "language_coach_cache_daily_stats_select_all_auth"
  on public.language_coach_cache_daily_stats
  for select
  using (auth.role() = 'authenticated');
