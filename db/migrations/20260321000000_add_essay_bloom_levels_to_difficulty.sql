-- Thêm 5 mức độ Bloom cho tự luận (tạo từng câu) – giống phiếu tạo một lần
-- Giữ easy/medium/hard cho trắc nghiệm
alter table worksheet_questions
  drop constraint if exists worksheet_questions_difficulty_check;

alter table worksheet_questions
  add constraint worksheet_questions_difficulty_check
  check (difficulty in (
    'easy', 'medium', 'hard',
    'nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'
  ));

comment on column worksheet_questions.difficulty is 'Quiz: easy/medium/hard. Essay: nhan-biet, thong-hieu, van-dung-thap, van-dung-cao, thuc-te (Bloom)';
