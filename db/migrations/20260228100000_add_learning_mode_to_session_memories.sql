-- Add learning_mode to session_memories so we can restore the correct mode when continuing a lesson.
ALTER TABLE public.language_coach_session_memories
  ADD COLUMN IF NOT EXISTS learning_mode text DEFAULT 'review'
  CHECK (learning_mode IN ('review', 'reflex'));

COMMENT ON COLUMN public.language_coach_session_memories.learning_mode IS 'review = full mode with pre-lesson, writing, typing. reflex = listen-speak only.';
