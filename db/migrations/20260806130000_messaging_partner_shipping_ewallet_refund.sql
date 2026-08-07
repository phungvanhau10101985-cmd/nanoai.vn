-- W1.7 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): phí vận chuyển + ví điện tử (QR thủ công,
-- giống cơ chế SePay QR — không tích hợp API cổng thật) + hoàn tiền. Additive-only.
--
-- Thiết kế quan trọng (đọc trước khi sửa code liên quan):
-- 1. `shipping_fee_amount` KHÔNG được cộng vào `messaging_partner_orders.amount_after_discount` —
--    cột đó vẫn giữ nguyên ý nghĩa "giá trị sản phẩm sau giảm giá" vì đang được dùng làm cơ sở tính
--    cọc (deposit) VÀ doanh thu/LTV ở M2.1 + S0.8 (fetchPartnerCustomersForAdminFromPg,
--    fetchPartnerRevenueSummaryFromPg). Đổi ý nghĩa cột này sẽ làm sai lệch toàn bộ báo cáo doanh
--    thu/khách hàng đã có. Phí ship là cột RIÊNG, chỉ cộng thêm lúc hiển thị tổng cuối cho khách.
-- 2. `payment_method` chỉ có ý nghĩa lựa chọn thật khi đơn CÓ đặt cọc (required_amount > 0) —
--    khi shop không yêu cầu cọc, mọi đơn coi như 'cod' (thanh toán khi nhận hàng), không đổi hành vi
--    hiện có.

alter table public.messaging_partner_payment_settings
  add column if not exists shipping_fee_amount numeric not null default 0,
  add column if not exists shipping_free_threshold_amount numeric,
  add column if not exists ewallet_enabled boolean not null default false,
  add column if not exists ewallet_provider_label text not null default '',
  add column if not exists ewallet_account_name text not null default '',
  add column if not exists ewallet_account_number text not null default '',
  add column if not exists ewallet_qr_url text not null default '';

comment on column public.messaging_partner_payment_settings.shipping_fee_amount is
  'Phí ship cố định (VND) áp cho mọi đơn, trừ khi đạt ngưỡng miễn phí ship. 0 = không thu phí ship (mặc định, giữ hành vi cũ).';
comment on column public.messaging_partner_payment_settings.shipping_free_threshold_amount is
  'Miễn phí ship khi giá trị đơn (sau giảm giá) >= ngưỡng này. NULL = không có ngưỡng miễn phí (luôn thu shipping_fee_amount).';
comment on column public.messaging_partner_payment_settings.ewallet_qr_url is
  'Ảnh QR tĩnh ví điện tử do merchant tự upload (giống VietQR tĩnh, KHÔNG nhúng số tiền/nội dung như QR ngân hàng) — khách tự nhập số tiền/ghi chú khi chuyển.';

alter table public.messaging_partner_orders
  add column if not exists payment_method text not null default 'cod',
  add column if not exists shipping_fee_amount numeric not null default 0,
  add column if not exists refund_status text not null default 'none',
  add column if not exists refund_amount numeric not null default 0,
  add column if not exists refund_note text not null default '',
  add column if not exists refunded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_orders_payment_method_check'
  ) then
    alter table public.messaging_partner_orders
      add constraint messaging_partner_orders_payment_method_check
      check (payment_method in ('cod', 'bank_transfer', 'ewallet'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'messaging_partner_orders_refund_status_check'
  ) then
    alter table public.messaging_partner_orders
      add constraint messaging_partner_orders_refund_status_check
      check (refund_status in ('none', 'requested', 'refunded'));
  end if;
end $$;

comment on column public.messaging_partner_orders.shipping_fee_amount is
  'Snapshot phí ship tại thời điểm đặt hàng (VND) — KHÔNG cộng vào amount_after_discount, chỉ dùng hiển thị tổng cuối cùng cho khách.';
comment on column public.messaging_partner_orders.payment_method is
  'Phương thức khách chọn để trả phần cọc/trả trước (nếu có): cod (không cọc, trả khi nhận) / bank_transfer / ewallet.';
comment on column public.messaging_partner_orders.refund_status is
  'none = chưa hoàn tiền; requested = khách/admin đánh dấu cần hoàn; refunded = đã hoàn xong (admin xác nhận thủ công).';
