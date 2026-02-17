-- Cột để phát hiện job "processing" bị kẹt (server restart) và reset về pending
alter table translate_jobs add column if not exists processing_started_at timestamptz;
