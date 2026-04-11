-- Enable pgvector-based ANN search for inventory image embeddings.
create extension if not exists vector;

-- Cần trước hàm match_* (cột product_url được bổ sung đầy đủ/comment ở 20260408120000).
alter table public.messaging_partner_inventory
  add column if not exists product_url text not null default '';

alter table public.messaging_partner_inventory
  add column if not exists image_embedding_vec vector(768);

comment on column public.messaging_partner_inventory.image_embedding_vec is
  'pgvector(768) embedding for fast ANN image similarity search.';

create index if not exists idx_messaging_partner_inventory_embedding_ivfflat
  on public.messaging_partner_inventory
  using ivfflat (image_embedding_vec vector_cosine_ops)
  with (lists = 200);

create or replace function public.match_messaging_partner_inventory_by_embedding(
  p_partner_id uuid,
  p_query vector(768),
  p_limit integer default 8,
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
    (1 - (mpi.image_embedding_vec <=> p_query))::double precision as score
  from public.messaging_partner_inventory mpi
  where mpi.partner_id = p_partner_id
    and mpi.is_active = true
    and mpi.image_embedding_vec is not null
    and (1 - (mpi.image_embedding_vec <=> p_query)) >= coalesce(p_min_score, 0)
  order by mpi.image_embedding_vec <=> p_query asc, mpi.sort_order asc
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;
