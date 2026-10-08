-- Gói khách mời tách nhà trai / nhà gái. Mỗi bên 3 khách dùng thử, rồi thanh toán gói riêng cùng bảng giá.
alter table public.wedding_cards
  add column if not exists groom_guest_pack text,
  add column if not exists bride_guest_pack text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wedding_cards_groom_guest_pack_check'
  ) then
    alter table public.wedding_cards
      add constraint wedding_cards_groom_guest_pack_check
      check (groom_guest_pack is null or groom_guest_pack in ('p50', 'p100', 'unlimited'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'wedding_cards_bride_guest_pack_check'
  ) then
    alter table public.wedding_cards
      add constraint wedding_cards_bride_guest_pack_check
      check (bride_guest_pack is null or bride_guest_pack in ('p50', 'p100', 'unlimited'));
  end if;
end $$;

-- Thiệp đã mua gói chung giữ đúng gói đó trên cả hai bên.
update public.wedding_cards
set groom_guest_pack = coalesce(groom_guest_pack, guest_pack),
    bride_guest_pack = coalesce(bride_guest_pack, guest_pack)
where guest_pack is not null;

comment on column public.wedding_cards.groom_guest_pack is
  'Gói khách nhà trai: null = 3 khách dùng thử, p50 = 50, p100 = 100, unlimited = không giới hạn.';
comment on column public.wedding_cards.bride_guest_pack is
  'Gói khách nhà gái: null = 3 khách dùng thử, p50 = 50, p100 = 100, unlimited = không giới hạn.';

alter table public.wedding_guest_pack_payments
  add column if not exists side text;

update public.wedding_guest_pack_payments
set side = 'groom'
where side is null or side not in ('groom', 'bride');

alter table public.wedding_guest_pack_payments
  alter column side set default 'groom';

alter table public.wedding_guest_pack_payments
  alter column side set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wedding_guest_pack_payments_side_check'
  ) then
    alter table public.wedding_guest_pack_payments
      add constraint wedding_guest_pack_payments_side_check
      check (side in ('groom', 'bride'));
  end if;
end $$;

comment on column public.wedding_guest_pack_payments.side is
  'Bên thanh toán: groom = nhà trai, bride = nhà gái. Mỗi bên một gói.';
