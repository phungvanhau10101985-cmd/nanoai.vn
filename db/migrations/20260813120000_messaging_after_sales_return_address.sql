-- Hậu mãi chat: địa chỉ shop nhận hàng hoàn / đổi size / trả hàng.
-- AI gửi địa chỉ này cho khách khi ảnh/ngữ cảnh là đổi size hoặc trả hàng.
-- Additive-only; để trống thì AI vẫn hướng dẫn quy trình, không tự bịa địa chỉ.

alter table public.messaging_partner_ai_settings
  add column if not exists after_sales_return_address text not null default '';

comment on column public.messaging_partner_ai_settings.after_sales_return_address is
  'Địa chỉ nhận hàng hoàn / đổi size / trả hàng. Shop điền trong Cài đặt AI; AI chèn vào tin hậu mãi. Rỗng = không gửi địa chỉ (không bịa).';
