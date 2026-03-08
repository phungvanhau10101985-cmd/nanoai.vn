/**
 * Cấu hình cho tính năng tạo đề trắc nghiệm.
 * Bám format THPT 2025, ma trận nhận thức.
 */

import { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'

export { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS }

/** Loại câu hỏi theo format Bộ Giáo dục */
export const QUESTION_TYPES = [
  { id: 'trac-nghiem', labelVi: 'Trắc nghiệm (A/B/C/D)', labelEn: 'Multiple choice' },
  { id: 'dung-sai', labelVi: 'Đúng / Sai', labelEn: 'True / False' },
  { id: 'tra-loi-ngan', labelVi: 'Trả lời ngắn', labelEn: 'Short answer' },
  { id: 'hon-hop', labelVi: 'Hỗn hợp (tất cả loại)', labelEn: 'Mixed (all types)' },
] as const

/** Phân bổ ma trận nhận thức (Thang Bloom) – % mặc định */
export const COGNITIVE_LEVELS = [
  { id: 'nhan-biet', labelVi: 'Nhận biết', labelEn: 'Remember', defaultPercent: 20 },
  { id: 'thong-hieu', labelVi: 'Thông hiểu', labelEn: 'Understand', defaultPercent: 30 },
  { id: 'van-dung-thap', labelVi: 'Vận dụng thấp', labelEn: 'Apply', defaultPercent: 30 },
  { id: 'van-dung-cao', labelVi: 'Vận dụng cao', labelEn: 'Analyze/Evaluate', defaultPercent: 20 },
] as const
