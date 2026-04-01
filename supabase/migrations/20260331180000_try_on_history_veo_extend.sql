-- Veo extension: Google-hosted video URI (short-lived, ~2 days) for chained generateVideos
alter table try_on_history add column if not exists veo_gemini_video_uri text;
-- Optional parent row when this clip was produced by extending another Veo output
alter table try_on_history add column if not exists veo_extend_parent_id uuid references try_on_history (id) on delete set null;

create index if not exists idx_try_on_history_veo_parent on try_on_history (veo_extend_parent_id)
where
  veo_extend_parent_id is not null;

comment on column try_on_history.veo_gemini_video_uri is 'Gemini API video resource URI for Veo extension; not a public Supabase URL';
