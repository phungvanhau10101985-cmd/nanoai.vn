-- Cho phép user cập nhật câu hỏi do chính mình tạo (lưu sửa phiếu, verified_at khi có policy phù hợp)
create policy "Users can update own worksheet questions"
  on worksheet_questions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on policy "Users can update own worksheet questions" on worksheet_questions is
  'Cập nhật content_json / verified_at cho câu thuộc user. Verify chéo phiếu người khác dùng service_role trên server.';
