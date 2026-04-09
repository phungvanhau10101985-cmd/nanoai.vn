-- Cho phép user đăng nhập xóa mục lục (khi refresh/Xem thêm)
create policy "Authenticated users can delete textbook lessons"
  on worksheet_textbook_lessons for delete
  using (auth.uid() is not null);
