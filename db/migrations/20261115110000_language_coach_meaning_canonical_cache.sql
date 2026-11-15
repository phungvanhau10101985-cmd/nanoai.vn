create table if not exists public.language_coach_meaning_canonical_cache (
  cache_key text primary key,
  native_language text not null default '',
  source_text text not null,
  canonical_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_language_coach_meaning_canonical_created
  on public.language_coach_meaning_canonical_cache(created_at desc);

alter table public.language_coach_meaning_canonical_cache enable row level security;

-- Không tạo policy: chỉ service role (API) truy cập cache, bypass RLS

create or replace function public.reset_language_coach_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.language_coach_live_lesson_turns cascade;
  truncate table public.language_coach_live_lesson_purchases cascade;
  truncate table public.language_coach_live_lesson_starts cascade;
  truncate table public.language_coach_live_lessons cascade;
  truncate table public.language_coach_preset_turns cascade;
  truncate table public.language_coach_turn_diagnostics cascade;
  truncate table public.language_coach_messages cascade;
  truncate table public.language_coach_session_memories cascade;
  truncate table public.language_coach_daily_words cascade;
  truncate table public.language_coach_completed_lessons cascade;
  truncate table public.language_coach_ended_sessions cascade;
  truncate table public.language_coach_hidden_sessions cascade;
  truncate table public.language_coach_credit_events cascade;
  truncate table public.language_coach_review_queue cascade;
  truncate table public.language_coach_learning_goals cascade;
  truncate table public.language_coach_progress_daily cascade;
  truncate table public.language_coach_assessments cascade;
  truncate table public.language_coach_tokenizations cascade;
  truncate table public.language_coach_dialogue_replay_cache cascade;
  truncate table public.language_coach_phrase_cache cascade;
  truncate table public.language_coach_vocab_cache cascade;
  truncate table public.language_coach_meaning_fix_failed cascade;
  truncate table public.language_coach_meaning_canonical_cache cascade;
  truncate table public.language_coach_transliteration_cache cascade;
  truncate table public.language_coach_opening_translation_cache cascade;
  truncate table public.language_coach_tts_cache cascade;
  truncate table public.language_coach_cache_daily_stats cascade;
  truncate table public.language_coach_custom_topics cascade;
  truncate table public.language_coach_topic_curricula cascade;
end;
$$;
