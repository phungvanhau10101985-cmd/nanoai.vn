-- Chi tiết chấm điểm (TN đúng/tổng, thang phụ) để hiển thị lớp / kết quả khi đề có TN + tự luận
-- Lưu ý: không dùng cùng timestamp với migration khác (vd. class_student_facing_labels).
alter table exam_attempts
  add column if not exists grading_meta jsonb not null default '{}'::jsonb;

comment on column exam_attempts.grading_meta is
  'JSON: quizCorrect, quizTotal, quizPoints, quizPointsMax, essayPointsMax';
