-- HS trong lớp xem được phiên đề thi gắn lớp (trang /lop/[id])
create policy "Class members can select exam sessions for their class"
  on public.exam_sessions for select
  using (
    auth.uid() is not null
    and class_id is not null
    and exists (
      select 1 from public.class_members m
      where m.class_id = exam_sessions.class_id
        and m.user_id = auth.uid()
    )
  );

-- HS xem bài làm của chính mình (tiến độ / kết quả)
create policy "Students can select own exam attempts"
  on public.exam_attempts for select
  using (auth.uid() is not null and user_id = auth.uid());
