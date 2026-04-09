-- Cho phép user cập nhật phiếu bài tập của chính mình (lưu content, thêm câu hỏi từ verify-and-save)
create policy "Users can update own worksheets"
  on worksheet_worksheets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
