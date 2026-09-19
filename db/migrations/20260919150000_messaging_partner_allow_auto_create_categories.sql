-- Công tắc tự tạo L1/L2/L3 khi cào 1688/Taobao/Tmall hoặc đăng sản phẩm.
-- Mặc định bật: giữ hành vi cũ (thiếu nhánh thì tạo). Tắt = chỉ gắn nhánh đã có đủ 3 cấp.
-- Form CRUD danh mục + import taxonomy_import.xlsx + seed demo không đọc cờ này.

alter table public.messaging_partners
  add column if not exists allow_auto_create_categories boolean not null default true;

comment on column public.messaging_partners.allow_auto_create_categories is
  'true = cào/đăng SP được tạo L1/L2/L3 mới; false = chỉ gắn nhánh đã có đủ 3 cấp, không insert category, không hoàn tất cào/đăng khi thiếu.';
