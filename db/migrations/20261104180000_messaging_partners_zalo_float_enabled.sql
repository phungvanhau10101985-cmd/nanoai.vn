-- Hide the corner Zalo float without clearing the personal number used by in-page message buttons.

alter table public.messaging_partners
  add column if not exists zalo_float_enabled boolean not null default true;

comment on column public.messaging_partners.zalo_float_enabled is
  'false hides the floating Zalo button (personal pill and OA widget). The personal number and in-page message buttons stay.';
