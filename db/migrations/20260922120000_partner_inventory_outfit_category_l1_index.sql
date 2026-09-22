-- Outfit / complementary PDP grids look up cards by catalog L1.
-- Additive. Same index for every shop — no slug lock.

create index if not exists idx_mpi_partner_active_category_l1
  on public.messaging_partner_inventory (partner_id, (lower(trim(category_l1))))
  where coalesce(is_active, true) = true
    and coalesce(trim(category_l1), '') <> '';
