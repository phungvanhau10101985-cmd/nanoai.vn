-- Add enrich_attempted flag to daily words and review queue to prevent infinite retries on problematic words.

ALTER TABLE language_coach_daily_words
ADD COLUMN enrich_attempted BOOLEAN DEFAULT FALSE;

ALTER TABLE language_coach_review_queue
ADD COLUMN enrich_attempted BOOLEAN DEFAULT FALSE;

-- Optional: Add an index to quickly find words that need enrichment.
CREATE INDEX IF NOT EXISTS idx_daily_words_needs_enrichment
ON language_coach_daily_words (user_id)
WHERE (enrich_attempted = FALSE);

CREATE INDEX IF NOT EXISTS idx_review_queue_needs_enrichment
ON language_coach_review_queue (user_id)
WHERE (enrich_attempted = FALSE);
