-- Khóa tài khoản khách shop (mặt «Quản lý thành viên» giống 188).
-- Mặc định đang hoạt động. Xóa cột không có — chỉ thêm.

alter table public.messaging_guest_accounts
  add column if not exists is_active boolean not null default true;

comment on column public.messaging_guest_accounts.is_active is
  'false = admin shop đã khóa. Khách không đăng nhập lại được cho đến khi mở khóa.';
