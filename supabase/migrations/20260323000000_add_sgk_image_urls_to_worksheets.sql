-- Lưu URL ảnh SGK tạm để verify câu "nhìn hình" bằng Gemini vision
alter table worksheet_worksheets
  add column if not exists sgk_image_urls text[] default '{}';

comment on column worksheet_worksheets.sgk_image_urls is 'URL ảnh SGK tạm (Storage) – dùng khi verify câu nhìn đồ thị/hình bằng Gemini vision. Xóa sau 24-48h.';
