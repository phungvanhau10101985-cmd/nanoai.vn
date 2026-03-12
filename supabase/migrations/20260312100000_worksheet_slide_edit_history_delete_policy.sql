-- Cho phép xóa lịch sử cũ (>7 ngày) – dùng cho cleanup
create policy "Authenticated users can delete slide edit history"
  on worksheet_slide_edit_history for delete
  using (auth.uid() is not null);
