-- Embedding văn bản kho (tên + giá + ghi chú tư vấn) cho tìm kiếm ngữ nghĩa, tương tự embedding ảnh.

alter table public.messaging_partner_inventory
  add column if not exists text_embedding_json jsonb,
  add column if not exists text_embedding_model text,
  add column if not exists text_embedding_dims integer,
  add column if not exists text_embedding_fingerprint text,
  add column if not exists text_embedding_updated_at timestamptz,
  add column if not exists text_embedding_error text;

alter table public.messaging_partner_inventory
  add column if not exists text_embedding_vec vector(768);

comment on column public.messaging_partner_inventory.text_embedding_json is
  'Gemini text embedding (JSON array) for catalog line: name + price_hint + consult_note.';
comment on column public.messaging_partner_inventory.text_embedding_vec is
  'pgvector(768) for ANN semantic search on customer queries vs catalog text.';

create index if not exists idx_messaging_partner_inventory_text_embedding_ivfflat
  on public.messaging_partner_inventory
  using ivfflat (text_embedding_vec vector_cosine_ops)
  with (lists = 200);

create or replace function public.match_messaging_partner_inventory_by_text_embedding(
  p_partner_id uuid,
  p_query vector(768),
  p_limit integer default 24,
  p_min_score double precision default 0
)
returns table (
  inventory_id uuid,
  name text,
  sku text,
  image_url text,
  product_url text,
  score double precision
)
language sql
stable
as $$
  select
    mpi.id as inventory_id,
    mpi.name,
    mpi.sku,
    mpi.image_url,
    mpi.product_url,
    (1 - (mpi.text_embedding_vec <=> p_query))::double precision as score
  from public.messaging_partner_inventory mpi
  where mpi.partner_id = p_partner_id
    and coalesce(mpi.is_active, true) = true
    and mpi.text_embedding_vec is not null
    and (1 - (mpi.text_embedding_vec <=> p_query)) >= coalesce(p_min_score, 0)
  order by mpi.text_embedding_vec <=> p_query asc, mpi.sort_order asc
  limit greatest(1, least(coalesce(p_limit, 24), 50));
$$;
