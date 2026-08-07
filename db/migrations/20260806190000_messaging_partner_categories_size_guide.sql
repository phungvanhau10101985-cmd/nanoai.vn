-- W1.5 — category-level size guide image (188-style) for PDP modal.
alter table public.messaging_partner_categories
  add column if not exists size_guide_image_url text not null default '';

comment on column public.messaging_partner_categories.size_guide_image_url is
  'W1.5 Size chart image URL shown on PDP when product belongs to this category (primary preferred)';
