-- Thêm cột image_size để theo dõi lượt gọi trả ảnh 2K hay 4K
alter table api_usage_log
  add column if not exists image_size text;

comment on column api_usage_log.image_size is 'Độ phân giải ảnh trả về: 1K, 2K, 4K, hoặc null (không trả ảnh)';

create index if not exists idx_api_usage_log_image_size on api_usage_log(image_size);
