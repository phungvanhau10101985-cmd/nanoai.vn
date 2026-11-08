-- Giờ tạo thiệp lệch đúng 7 giờ.
-- Default cũ: timezone('utc', now()) trả timestamp KHÔNG có múi giờ.
-- Session Asia/Ho_Chi_Minh hiểu giờ UTC đó thành giờ Việt Nam, nên created_at
-- sớm 7 giờ (tạo lúc 14:12 thì trang quản lý hiện 07:12).
-- now() là timestamptz, không bị cắt múi giờ.

alter table public.wedding_cards
  alter column created_at set default now();

-- Slug thiệp có dạng thiep-{base36(Date.now())}-{rand}. Chỉ sửa dòng
-- mà mốc trong slug muộn hơn created_at khoảng 7 giờ. Mẫu không theo
-- dạng đó (vd. thiep-hong-baby-mau) giữ nguyên. Chạy lại thì không còn
-- dòng nào khớp, nên không cộng thêm lần nữa.
do $$
declare
  rec record;
  part text;
  i int;
  n bigint;
  digit int;
  slug_ts timestamptz;
begin
  for rec in
    select id, slug, created_at
    from public.wedding_cards
  loop
    if rec.slug !~ '^thiep-[0-9a-z]+-[0-9a-z]+$' then
      continue;
    end if;
    part := split_part(rec.slug, '-', 2);
    n := 0;
    for i in 1..char_length(part) loop
      digit := position(substr(part, i, 1) in '0123456789abcdefghijklmnopqrstuvwxyz') - 1;
      if digit < 0 then
        n := null;
        exit;
      end if;
      n := n * 36 + digit;
    end loop;
    if n is null or n < 1000000000000 or n > 20000000000000 then
      continue;
    end if;
    slug_ts := to_timestamp(n::double precision / 1000.0);
    if slug_ts - rec.created_at between interval '6 hours 50 minutes' and interval '7 hours 10 minutes' then
      update public.wedding_cards
      set created_at = slug_ts
      where id = rec.id;
    end if;
  end loop;
end $$;
