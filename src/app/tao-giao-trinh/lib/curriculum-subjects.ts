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

type GradeName = {
  id: string
  labelVi: string
  labelEn: string
  labelZh: string
  labelJa: string
  labelKo: string
}

/** Cấp độ chọn được. Mỗi mã là một khóa cache riêng. Không có mục «Khác». */
export const GRADE_LEVELS: readonly GradeName[] = [
  { id: 'nha-tre-3-12-thang', labelVi: 'Nhà trẻ 3–12 tháng', labelEn: 'Nursery 3–12 months', labelZh: '托儿 3–12 个月', labelJa: '保育 3～12 か月', labelKo: '어린이집 3–12개월' },
  { id: 'nha-tre-12-24-thang', labelVi: 'Nhà trẻ 12–24 tháng', labelEn: 'Nursery 12–24 months', labelZh: '托儿 12–24 个月', labelJa: '保育 12～24 か月', labelKo: '어린이집 12–24개월' },
  { id: 'nha-tre-24-36-thang', labelVi: 'Nhà trẻ 24–36 tháng', labelEn: 'Nursery 24–36 months', labelZh: '托儿 24–36 个月', labelJa: '保育 24～36 か月', labelKo: '어린이집 24–36개월' },
  { id: 'mau-giao-3-4-tuoi', labelVi: 'Mẫu giáo 3–4 tuổi (Mầm)', labelEn: 'Preschool 3–4 years', labelZh: '幼儿 3–4 岁', labelJa: '幼稚園 3～4 歳', labelKo: '유치원 3–4세' },
  { id: 'mau-giao-4-5-tuoi', labelVi: 'Mẫu giáo 4–5 tuổi (Chồi)', labelEn: 'Preschool 4–5 years', labelZh: '幼儿 4–5 岁', labelJa: '幼稚園 4～5 歳', labelKo: '유치원 4–5세' },
  { id: 'mau-giao-5-6-tuoi', labelVi: 'Mẫu giáo 5–6 tuổi (Lá)', labelEn: 'Preschool 5–6 years', labelZh: '幼儿 5–6 岁', labelJa: '幼稚園 5～6 歳', labelKo: '유치원 5–6세' },
  { id: 'lop-1', labelVi: 'Lớp 1', labelEn: 'Grade 1', labelZh: '1年级', labelJa: '1年生', labelKo: '1학년' },
  { id: 'lop-2', labelVi: 'Lớp 2', labelEn: 'Grade 2', labelZh: '2年级', labelJa: '2年生', labelKo: '2학년' },
  { id: 'lop-3', labelVi: 'Lớp 3', labelEn: 'Grade 3', labelZh: '3年级', labelJa: '3年生', labelKo: '3학년' },
  { id: 'lop-4', labelVi: 'Lớp 4', labelEn: 'Grade 4', labelZh: '4年级', labelJa: '4年生', labelKo: '4학년' },
  { id: 'lop-5', labelVi: 'Lớp 5', labelEn: 'Grade 5', labelZh: '5年级', labelJa: '5年生', labelKo: '5학년' },
  { id: 'lop-6', labelVi: 'Lớp 6', labelEn: 'Grade 6', labelZh: '6年级', labelJa: '6年生', labelKo: '6학년' },
  { id: 'lop-7', labelVi: 'Lớp 7', labelEn: 'Grade 7', labelZh: '7年级', labelJa: '7年生', labelKo: '7학년' },
  { id: 'lop-8', labelVi: 'Lớp 8', labelEn: 'Grade 8', labelZh: '8年级', labelJa: '8年生', labelKo: '8학년' },
  { id: 'lop-9', labelVi: 'Lớp 9', labelEn: 'Grade 9', labelZh: '9年级', labelJa: '9年生', labelKo: '9학년' },
  { id: 'lop-10', labelVi: 'Lớp 10', labelEn: 'Grade 10', labelZh: '10年级', labelJa: '10年生', labelKo: '10학년' },
  { id: 'lop-11', labelVi: 'Lớp 11', labelEn: 'Grade 11', labelZh: '11年级', labelJa: '11年生', labelKo: '11학년' },
  { id: 'lop-12', labelVi: 'Lớp 12', labelEn: 'Grade 12', labelZh: '12年级', labelJa: '12年生', labelKo: '12학년' },
  { id: 'hoc-nghe', labelVi: 'Học nghề (sơ cấp)', labelEn: 'Vocational (entry)', labelZh: '职业初级', labelJa: '職業（初級）', labelKo: '직업훈련 (초급)' },
  { id: 'trung-cap', labelVi: 'Trung cấp', labelEn: 'Intermediate vocational', labelZh: '中级职业', labelJa: '中級職業', labelKo: '중급 직업' },
  { id: 'cao-dang', labelVi: 'Cao đẳng', labelEn: 'College', labelZh: '大专', labelJa: '短大', labelKo: '전문대' },
  { id: 'dai-hoc', labelVi: 'Đại học', labelEn: 'University', labelZh: '大学', labelJa: '大学', labelKo: '대학교' },
  { id: 'cao-hoc', labelVi: 'Cao học (thạc sĩ)', labelEn: "Master's", labelZh: '硕士', labelJa: '修士', labelKo: '석사' },
  { id: 'tien-si', labelVi: 'Tiến sĩ', labelEn: 'Doctorate', labelZh: '博士', labelJa: '博士', labelKo: '박사' },
]

/** Giáo trình đã lưu với mã cũ. Không hiện trong danh sách chọn mới. */
export const LEGACY_GRADE_LEVELS: readonly GradeName[] = [
  { id: 'khac', labelVi: 'Khác', labelEn: 'Other', labelZh: '其他', labelJa: 'その他', labelKo: '기타' },
]

const STORED_GRADE_LEVELS: readonly GradeName[] = [...GRADE_LEVELS, ...LEGACY_GRADE_LEVELS]

/** Nhóm chỉ để hiện trong danh sách. Không có nhóm «Khác». */
export const GRADE_LEVEL_GROUPS: readonly {
  labelVi: string
  labelEn: string
  labelZh: string
  labelJa: string
  labelKo: string
  ids: readonly string[]
}[] = [
  {
    labelVi: 'Mầm non',
    labelEn: 'Preschool',
    labelZh: '学前教育',
    labelJa: '就学前教育',
    labelKo: '유아교육',
    ids: ['nha-tre-3-12-thang', 'nha-tre-12-24-thang', 'nha-tre-24-36-thang', 'mau-giao-3-4-tuoi', 'mau-giao-4-5-tuoi', 'mau-giao-5-6-tuoi'],
  },
  {
    labelVi: 'Tiểu học (1–5)',
    labelEn: 'Primary (1–5)',
    labelZh: '小学（1–5）',
    labelJa: '小学校（1–5）',
    labelKo: '초등학교 (1–5)',
    ids: ['lop-1', 'lop-2', 'lop-3', 'lop-4', 'lop-5'],
  },
  {
    labelVi: 'THCS (6–9)',
    labelEn: 'Middle school (6–9)',
    labelZh: '初中（6–9）',
    labelJa: '中学校（6–9）',
    labelKo: '중학교 (6–9)',
    ids: ['lop-6', 'lop-7', 'lop-8', 'lop-9'],
  },
  {
    labelVi: 'THPT (10–12)',
    labelEn: 'High school (10–12)',
    labelZh: '高中（10–12）',
    labelJa: '高校（10–12）',
    labelKo: '고등학교 (10–12)',
    ids: ['lop-10', 'lop-11', 'lop-12'],
  },
  {
    labelVi: 'Giáo dục nghề nghiệp',
    labelEn: 'Vocational education',
    labelZh: '职业教育',
    labelJa: '職業教育',
    labelKo: '직업교육',
    ids: ['hoc-nghe', 'trung-cap', 'cao-dang'],
  },
  {
    labelVi: 'Giáo dục đại học',
    labelEn: 'Higher education',
    labelZh: '高等教育',
    labelJa: '高等教育',
    labelKo: '고등교육',
    ids: ['dai-hoc', 'cao-hoc', 'tien-si'],
  },
]

function localizedGradeName(row: GradeName, locale: string): string {
  if (locale === 'en') return row.labelEn
  if (locale === 'zh') return row.labelZh
  if (locale === 'ja') return row.labelJa
  if (locale === 'ko') return row.labelKo
  return row.labelVi
}

export function gradeLevelLabel(id: string, locale: string): string {
  const key = id.trim()
  if (!key) return ''
  const row = STORED_GRADE_LEVELS.find((g) => g.id === key)
  if (row) return localizedGradeName(row, locale)
  const lop = /^lop-(\d+)$/.exec(key)
  if (!lop) return key
  const n = lop[1]
  if (locale === 'en') return `Grade ${n}`
  if (locale === 'zh') return `${n}年级`
  if (locale === 'ja') return `${n}年生`
  if (locale === 'ko') return `${n}학년`
  return `Lớp ${n}`
}

export function gradeGroupLabel(
  group: { labelVi: string; labelEn: string; labelZh: string; labelJa: string; labelKo: string },
  locale: string,
): string {
  if (locale === 'en') return group.labelEn
  if (locale === 'zh') return group.labelZh
  if (locale === 'ja') return group.labelJa
  if (locale === 'ko') return group.labelKo
  return group.labelVi
}

/** Mã đang chọn mới, hoặc mã cũ `khac` của giáo trình đã lưu. */
export function isStoredGradeLevelId(id: string): boolean {
  return STORED_GRADE_LEVELS.some((g) => g.id === id)
}

/** Khối được chọn khi tạo lớp. Không nhận mã cũ `khac`. */
export function isSelectableGradeLevelId(id: string): boolean {
  return GRADE_LEVELS.some((g) => g.id === id)
}

/** Bộ sách giáo khoa GDPT 2018 (VN) + Khác (sách NXB khác, nước ngoài, v.v.) */
export const TEXTBOOK_SETS = [
  { id: 'ket-noi-tri-thuc', labelVi: 'Kết nối tri thức với cuộc sống', labelEn: 'Kết nối tri thức' },
  { id: 'canh-dieu', labelVi: 'Cánh diều', labelEn: 'Cánh diều' },
  { id: 'chan-troi-sang-tao', labelVi: 'Chân trời sáng tạo', labelEn: 'Chân trời sáng tạo' },
  { id: 'khac', labelVi: 'Khác / Sách khác NXB', labelEn: 'Other / Other publisher' },
] as const

/** Loại bài học – mỗi loại có cấu trúc giáo án khác nhau */
export const LESSON_TYPES = [
  { id: 'hinh-thanh-kien-thuc', labelVi: 'Bài hình thành kiến thức mới (Lý thuyết)', labelEn: 'New knowledge (Theory)' },
  { id: 'luyen-tap', labelVi: 'Bài luyện tập / Ôn tập', labelEn: 'Practice / Review' },
  { id: 'thuc-hanh', labelVi: 'Bài thực hành', labelEn: 'Hands-on / Lab' },
] as const
