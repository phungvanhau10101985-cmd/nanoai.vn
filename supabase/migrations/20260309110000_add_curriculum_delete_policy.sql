-- Cho phép user xóa giáo trình do mình tạo
create policy "Users can delete own curricula"
  on worksheet_curricula for delete
  using (user_id = auth.uid());
