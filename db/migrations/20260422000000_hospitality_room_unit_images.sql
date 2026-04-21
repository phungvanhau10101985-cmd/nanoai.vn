-- Chuyển hospitality_room_images từ gắn với loại phòng (room_type_id) sang
-- gắn với phòng thực tế (room_id) — mỗi phòng có bộ ảnh riêng.

-- Thêm cột room_id (nullable tạm) và di chuyển dữ liệu hiện có (nếu có) sang
-- phòng đầu tiên thuộc loại tương ứng; những ảnh không có phòng nào sẽ bị loại bỏ.
alter table public.hospitality_room_images
  add column if not exists room_id uuid null references public.hospitality_rooms (id) on delete cascade;

update public.hospitality_room_images img
set room_id = sub.room_id
from (
  select distinct on (rt.id) rt.id as room_type_id, r.id as room_id
  from public.hospitality_room_types rt
  join public.hospitality_rooms r on r.room_type_id = rt.id
  order by rt.id, r.created_at asc
) sub
where img.room_id is null
  and img.room_type_id = sub.room_type_id;

-- Xoá các ảnh không gắn được với phòng thực tế.
delete from public.hospitality_room_images where room_id is null;

-- Sau khi dọn dẹp, room_id trở thành bắt buộc và bỏ cột room_type_id cũ.
alter table public.hospitality_room_images
  alter column room_id set not null;

alter table public.hospitality_room_images
  drop column if exists room_type_id;

create index if not exists idx_hospitality_room_images_room
  on public.hospitality_room_images (room_id, sort_order);

comment on table public.hospitality_room_images is
  'Ảnh cho từng phòng thực tế (không theo loại phòng) — hiển thị khi tư vấn hoặc xác nhận đặt phòng.';
