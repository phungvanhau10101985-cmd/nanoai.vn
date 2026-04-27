-- Lịch sử: tăng trần ANN lên 70; bản chuẩn hiện tại là 68 — xem `20260427130000_messaging_inventory_vector_match_limit_68.sql`.
-- Trước: ảnh least(..., 25), văn least(..., 50).

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
  limit greatest(1, least(coalesce(p_limit, 8), 70));
$$;

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
  limit greatest(1, least(coalesce(p_limit, 24), 70));
$$;
