-- Học sinh tự rời lớp: xóa dòng class_members của chính mình (không áp dụng cho chủ lớp qua app — server chặn)

create policy "Members can leave class (delete own enrollment)"
  on class_members for delete
  using (user_id = auth.uid());
