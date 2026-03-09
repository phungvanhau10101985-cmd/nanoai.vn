-- Người tạo có thể xóa đề xuất khi chưa có ai bình chọn
create policy "Users can delete own proposals when no votes"
  on slide_edit_proposals for delete
  using (
    proposed_by = auth.uid()
    and status = 'pending'
    and agree_count = 0
    and disagree_count = 0
  );
