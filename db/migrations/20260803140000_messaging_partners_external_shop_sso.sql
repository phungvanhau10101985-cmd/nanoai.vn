-- Web shop riêng của đối tác (SSO Google / customer-token) — tuỳ chọn, tự điền từ kho SP nếu để trống.
alter table public.messaging_partners
  add column if not exists external_shop_origin text null,
  add column if not exists external_shop_login_path text not null default '/dang-nhap';

comment on column public.messaging_partners.external_shop_origin is
  'Origin HTTPS web shop đối tác (vd. https://188.com.vn). Để trống → hệ thống suy từ product_url trong kho.';
comment on column public.messaging_partners.external_shop_login_path is
  'Path trang đăng nhập shop (mặc định /dang-nhap) — dùng khi redirect Google SSO từ /site/{slug}.';
