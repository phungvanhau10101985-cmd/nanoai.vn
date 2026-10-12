-- Chuông NanoAI lệch đúng 7 giờ.
-- Default cũ: timezone('utc', now()) trả timestamp KHÔNG có múi giờ.
-- Session Asia/Ho_Chi_Minh hiểu giờ UTC đó thành giờ Việt Nam, nên created_at
-- sớm 7 giờ so với đơn (đơn 21:33, chuông ghi 14:33 → «7 giờ trước»).
-- now() là timestamptz, không bị cắt múi giờ.

alter table public.notifications
  alter column created_at set default now();

-- Cộng 7 giờ một lần, khi còn đơn mới lệch ~7 giờ so với đơn thật.
-- Dòng đã đúng (created_at + 7 giờ nằm ở tương lai) không bị đụng.
do $$
begin
  if exists (
    select 1
    from public.notifications n
    join public.messaging_partner_orders o
      on o.id::text = n.meta->>'order_id'
    where n.type = 'messaging_partner_new_order'
      and o.created_at - n.created_at
        between interval '6 hours 50 minutes' and interval '7 hours 10 minutes'
  ) then
    update public.notifications
    set created_at = created_at + interval '7 hours'
    where created_at + interval '7 hours' <= now() + interval '2 minutes';
  end if;
end $$;
