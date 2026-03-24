-- Điểm tối đa từng câu (TN theo mức độ / TL do GV nhập)
alter table exam_questions
  add column if not exists points numeric(6,2) not null default 1;

comment on column exam_questions.points is
  'Điểm tối đa câu: TN cộng khi đúng; TL là trần khi chấm tay';

-- Cho phép tổng điểm thập phân (ví dụ 1,5 điểm/câu)
alter table exam_attempts
  alter column score type numeric(10,2) using round(score::numeric, 2),
  alter column max_score type numeric(10,2) using round(max_score::numeric, 2);
