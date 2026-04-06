-- Store precomputed Gemini image embeddings for partner inventory items.
alter table public.messaging_partner_inventory
  add column if not exists image_embedding_json jsonb,
  add column if not exists image_embedding_model text,
  add column if not exists image_embedding_dims integer,
  add column if not exists image_embedding_fingerprint text,
  add column if not exists image_embedding_updated_at timestamptz,
  add column if not exists image_embedding_error text;

comment on column public.messaging_partner_inventory.image_embedding_json is
  'Gemini image embedding vector stored as JSON array of numbers.';
comment on column public.messaging_partner_inventory.image_embedding_model is
  'Embedding model name, e.g. gemini-embedding-2-preview.';
comment on column public.messaging_partner_inventory.image_embedding_dims is
  'Embedding dimensions used when generating image_embedding_json.';
comment on column public.messaging_partner_inventory.image_embedding_fingerprint is
  'Fingerprint of fields that affect embedding (image_url + name) to know when to refresh.';
comment on column public.messaging_partner_inventory.image_embedding_updated_at is
  'Timestamp when embedding was last generated/refreshed.';
comment on column public.messaging_partner_inventory.image_embedding_error is
  'Last embedding sync error (if any).';
