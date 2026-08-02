-- One creation journal per partner website (stored as JSON timeline of Q&A, mockup, edits).
alter table public.messaging_partner_websites
  add column if not exists creation_journal_json jsonb;

comment on column public.messaging_partner_websites.creation_journal_json is
  'Single creation journal per site: discovery steps, mockup, build, and subsequent edit log.';
