-- Bảng lưu mục lục bài học chuẩn theo sách giáo khoa (để chuẩn hóa chủ đề khi tìm kiếm)
create table if not exists worksheet_textbook_lessons (
  id uuid default gen_random_uuid() primary key,
  subject_id text not null default 'toan',
  grade_level_id text not null default 'lop-12',
  textbook_set_id text not null default 'ket-noi-tri-thuc',
  lesson_order int not null default 0,
  chapter_label text,
  title text not null,
  title_normalized text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_textbook_lessons_lookup on worksheet_textbook_lessons(subject_id, grade_level_id, textbook_set_id);
create index idx_textbook_lessons_normalized on worksheet_textbook_lessons(title_normalized);

alter table worksheet_textbook_lessons enable row level security;

create policy "Anyone can read textbook lessons"
  on worksheet_textbook_lessons for select
  using (true);

comment on table worksheet_textbook_lessons is 'Mục lục bài học chuẩn SGK – dùng để chuẩn hóa chủ đề khi giáo viên nhập';

-- Seed: Toán 12 - Kết nối tri thức (một số bài)
insert into worksheet_textbook_lessons (subject_id, grade_level_id, textbook_set_id, lesson_order, chapter_label, title, title_normalized) values
('toan', 'lop-12', 'ket-noi-tri-thuc', 1, 'Chương I: Ứng dụng đạo hàm', 'Bài 1: Tính đơn điệu và cực trị của hàm số', 'bai 1 tinh don dieu va cuc tri cua ham so'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 2, 'Chương I', 'Bài 2: Giá trị lớn nhất và giá trị nhỏ nhất của hàm số', 'bai 2 gia tri lon nhat va gia tri nho nhat cua ham so'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 3, 'Chương I', 'Bài 3: Đường tiệm cận của đồ thị hàm số', 'bai 3 duong tiem can cua do thi ham so'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 4, 'Chương I', 'Bài 4: Khảo sát sự biến thiên và vẽ đồ thị của hàm số', 'bai 4 khao sat su bien thien va ve do thi cua ham so'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 5, 'Chương I', 'Bài 5: Ứng dụng đạo hàm để giải quyết vấn đề thực tiễn', 'bai 5 ung dung dao ham de giai quyet van de thuc tien'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 6, 'Chương II: Vectơ trong không gian', 'Bài 6: Vectơ trong không gian', 'bai 6 vecto trong khong gian'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 7, 'Chương II', 'Bài 7: Hệ trục tọa độ trong không gian', 'bai 7 he truc toa do trong khong gian'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 8, 'Chương II', 'Bài 8: Biểu thức tọa độ của các phép toán vectơ', 'bai 8 bieu thuc toa do cua cac phep toan vecto'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 9, 'Chương III', 'Bài 9: Khoảng biến thiên và khoảng tứ phân vị', 'bai 9 khoang bien thien va khoang tu phan vi'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 10, 'Chương III', 'Bài 10: Phương sai và độ lệch chuẩn', 'bai 10 phuong sai va do lech chuan'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 11, 'Chương IV: Nguyên hàm và tích phân', 'Bài 11: Nguyên hàm', 'bai 11 nguyen ham'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 12, 'Chương IV', 'Bài 12: Tích phân', 'bai 12 tich phan'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 13, 'Chương IV', 'Bài 13: Ứng dụng hình học của tích phân', 'bai 13 ung dung hinh hoc cua tich phan'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 14, 'Chương V: Phương pháp tọa độ', 'Bài 14: Phương trình mặt phẳng', 'bai 14 phuong trinh mat phang'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 15, 'Chương V', 'Bài 15: Phương trình đường thẳng trong không gian', 'bai 15 phuong trinh duong thang trong khong gian'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 16, 'Chương V', 'Bài 16: Công thức tính góc trong không gian', 'bai 16 cong thuc tinh goc trong khong gian'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 17, 'Chương V', 'Bài 17: Phương trình mặt cầu', 'bai 17 phuong trinh mat cau'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 18, 'Chương VI: Xác suất có điều kiện', 'Bài 18: Xác suất có điều kiện', 'bai 18 xac suat co dieu kien'),
('toan', 'lop-12', 'ket-noi-tri-thuc', 19, 'Chương VI', 'Bài 19: Công thức xác suất toàn phần và Bayes', 'bai 19 cong thuc xac suat toan phan va bayes');
