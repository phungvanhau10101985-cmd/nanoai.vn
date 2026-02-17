-- Thêm cột feature để phân biệt try_on, translate, v.v.
alter table try_on_history add column if not exists feature text default 'try_on';

-- Các bản ghi có original = garment thường là dịch ảnh (translate)
update try_on_history set feature = 'translate' where original_image_url = garment_image_url and feature = 'try_on';

create index if not exists idx_try_on_history_feature on try_on_history(feature);
