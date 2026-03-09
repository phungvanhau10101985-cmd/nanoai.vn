/**
 * Môn học và cấp độ cho tính năng tạo giáo trình.
 * Hỗ trợ chương trình giáo dục Việt Nam.
 */

export const SUBJECTS = [
  { id: 'toan', labelVi: 'Toán học', labelEn: 'Mathematics' },
  { id: 'ngu-van', labelVi: 'Ngữ văn', labelEn: 'Literature' },
  { id: 'tieng-anh', labelVi: 'Tiếng Anh', labelEn: 'English' },
  { id: 'vat-ly', labelVi: 'Vật lý', labelEn: 'Physics' },
  { id: 'hoa-hoc', labelVi: 'Hóa học', labelEn: 'Chemistry' },
  { id: 'sinh-hoc', labelVi: 'Sinh học', labelEn: 'Biology' },
  { id: 'lich-su', labelVi: 'Lịch sử', labelEn: 'History' },
  { id: 'dia-ly', labelVi: 'Địa lý', labelEn: 'Geography' },
  { id: 'gdcd', labelVi: 'Giáo dục công dân', labelEn: 'Civics' },
  { id: 'tin-hoc', labelVi: 'Tin học', labelEn: 'Computer Science' },
  { id: 'cong-nghe', labelVi: 'Công nghệ', labelEn: 'Technology' },
  { id: 'am-nhac', labelVi: 'Âm nhạc', labelEn: 'Music' },
  { id: 'my-thuat', labelVi: 'Mỹ thuật', labelEn: 'Arts' },
  { id: 'the-duc', labelVi: 'Thể dục', labelEn: 'Physical Education' },
  { id: 'khac', labelVi: 'Khác', labelEn: 'Other' },
] as const

/** Cấp độ có thể chọn – chỉ lớp cụ thể, không có nhóm */
export const GRADE_LEVELS = [
  { id: 'lop-1', labelVi: 'Lớp 1', labelEn: 'Grade 1' },
  { id: 'lop-2', labelVi: 'Lớp 2', labelEn: 'Grade 2' },
  { id: 'lop-3', labelVi: 'Lớp 3', labelEn: 'Grade 3' },
  { id: 'lop-4', labelVi: 'Lớp 4', labelEn: 'Grade 4' },
  { id: 'lop-5', labelVi: 'Lớp 5', labelEn: 'Grade 5' },
  { id: 'lop-6', labelVi: 'Lớp 6', labelEn: 'Grade 6' },
  { id: 'lop-7', labelVi: 'Lớp 7', labelEn: 'Grade 7' },
  { id: 'lop-8', labelVi: 'Lớp 8', labelEn: 'Grade 8' },
  { id: 'lop-9', labelVi: 'Lớp 9', labelEn: 'Grade 9' },
  { id: 'lop-10', labelVi: 'Lớp 10', labelEn: 'Grade 10' },
  { id: 'lop-11', labelVi: 'Lớp 11', labelEn: 'Grade 11' },
  { id: 'lop-12', labelVi: 'Lớp 12', labelEn: 'Grade 12' },
  { id: 'dai-hoc', labelVi: 'Đại học', labelEn: 'University' },
  { id: 'khac', labelVi: 'Khác', labelEn: 'Other' },
] as const

/** Nhóm cấp độ – chỉ để hiển thị, không chọn được */
export const GRADE_LEVEL_GROUPS = [
  { labelVi: 'Tiểu học (1–5)', labelEn: 'Primary (1–5)', ids: ['lop-1', 'lop-2', 'lop-3', 'lop-4', 'lop-5'] },
  { labelVi: 'THCS (6–9)', labelEn: 'Middle School (6–9)', ids: ['lop-6', 'lop-7', 'lop-8', 'lop-9'] },
  { labelVi: 'THPT (10–12)', labelEn: 'High School (10–12)', ids: ['lop-10', 'lop-11', 'lop-12'] },
  { labelVi: 'Khác', labelEn: 'Other', ids: ['dai-hoc', 'khac'] },
] as const

/** Bộ sách giáo khoa GDPT 2018 (VN) */
export const TEXTBOOK_SETS = [
  { id: 'ket-noi-tri-thuc', labelVi: 'Kết nối tri thức với cuộc sống', labelEn: 'Kết nối tri thức' },
  { id: 'canh-dieu', labelVi: 'Cánh diều', labelEn: 'Cánh diều' },
  { id: 'chan-troi-sang-tao', labelVi: 'Chân trời sáng tạo', labelEn: 'Chân trời sáng tạo' },
  { id: 'khac', labelVi: 'Không chỉ định / Khác', labelEn: 'Not specified / Other' },
] as const

/** Loại bài học – mỗi loại có cấu trúc giáo án khác nhau */
export const LESSON_TYPES = [
  { id: 'hinh-thanh-kien-thuc', labelVi: 'Bài hình thành kiến thức mới (Lý thuyết)', labelEn: 'New knowledge (Theory)' },
  { id: 'luyen-tap', labelVi: 'Bài luyện tập / Ôn tập', labelEn: 'Practice / Review' },
  { id: 'thuc-hanh', labelVi: 'Bài thực hành', labelEn: 'Hands-on / Lab' },
] as const
