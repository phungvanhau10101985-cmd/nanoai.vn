-- Shop Zalo click target: personal number or Official Account widget.

alter table public.messaging_partners
  add column if not exists zalo_open text;

comment on column public.messaging_partners.zalo_open is 'personal = Zalo buttons open zalo_personal_url and the OA widget stays off. oa = buttons and the widget use the Official Account.';
