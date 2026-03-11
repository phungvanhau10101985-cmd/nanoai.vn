-- =============================================================================
-- RESET DỮ LIỆU AI TEST – Xóa toàn bộ dữ liệu do AI tạo ra để test lại
-- =============================================================================
--
-- GIỮ LẠI (KHÔNG BAO GIỜ XÓA):
--   - auth.users, profiles     → Tài khoản
--   - credits                   → Số dư credit
--   - transactions              → Lịch sử giao dịch
--   - worksheet_official_questions → Câu hỏi đã up lên (ngân hàng Bộ GD, VNHSGE)
--   - worksheet_textbook_lessons → Mục lục bài học chuẩn SGK (seed)
--
-- XÓA: Giáo trình AI, bài thi, phiếu bài tập, học ngoại ngữ AI, nhạc, thử đồ, v.v.
--
-- Cách chạy: Supabase Dashboard → SQL Editor → paste và Run
-- =============================================================================

begin;

-- 1. Bài thi (CASCADE xóa exam_questions, exam_attempts)
truncate table public.exam_sessions cascade;

-- 2. Giáo trình & phiếu (CASCADE xóa slides, quiz, opened/hidden, worksheets, v.v.)
truncate table public.worksheet_curricula cascade;
truncate table public.worksheet_worksheets cascade;  -- có thể curriculum_id null

-- 3. Language coach – live lessons (CASCADE xóa turns, starts, purchases)
truncate table public.language_coach_live_lessons cascade;

-- 4. Language coach – còn lại
truncate table public.language_coach_credit_events cascade;
truncate table public.language_coach_ended_sessions cascade;
truncate table public.language_coach_hidden_sessions cascade;
truncate table public.language_coach_completed_lessons cascade;
truncate table public.language_coach_messages cascade;
truncate table public.language_coach_session_memories cascade;
truncate table public.language_coach_tokenizations cascade;
truncate table public.language_coach_turn_diagnostics cascade;
truncate table public.language_coach_assessments cascade;
truncate table public.language_coach_daily_words cascade;
truncate table public.language_coach_learning_goals cascade;
truncate table public.language_coach_progress_daily cascade;
truncate table public.language_coach_review_queue cascade;
truncate table public.language_coach_custom_topics cascade;
truncate table public.language_coach_topic_curricula cascade;
truncate table public.language_coach_preset_turns cascade;
truncate table public.language_coach_meaning_fix_failed cascade;
truncate table public.language_coach_phrase_cache cascade;
truncate table public.language_coach_vocab_cache cascade;
truncate table public.language_coach_tts_cache cascade;
truncate table public.language_coach_transliteration_cache cascade;
truncate table public.language_coach_dialogue_replay_cache cascade;
truncate table public.language_coach_opening_translation_cache cascade;
truncate table public.language_coach_cache_daily_stats cascade;

-- 5. Khác – AI tạo (try_on_history CASCADE xóa translate_jobs)
truncate table public.music_generations cascade;
truncate table public.try_on_history cascade;
truncate table public.house_build_projects cascade;
truncate table public.api_usage_log cascade;
truncate table public.notifications cascade;

commit;

-- Xong. Kiểm tra: profiles, credits, transactions, worksheet_official_questions vẫn còn.
