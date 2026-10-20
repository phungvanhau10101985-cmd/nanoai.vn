import { CURRICULUM_MATH_CHECK_RULES } from '@/app/tao-giao-trinh/lib/curriculum-math-check'

/** Bản giáo án tự viết theo mạch kiến thức. Cache cũ không có dấu này thì không phát lại. */
export const CURRICULUM_ORIGINAL_BODY_MARKER = '<!-- curriculum-body-policy:original-knowledge -->'

const MARKER_RE = /<!--\s*curriculum-body-policy:original-knowledge\s*-->\s*/g

export function curriculumMarkdownIsOriginalBody(markdown: string | null | undefined): boolean {
  return String(markdown ?? '').includes('curriculum-body-policy:original-knowledge')
}

export function stripCurriculumOriginalBodyMarker(markdown: string | null | undefined): string {
  return String(markdown ?? '').replace(MARKER_RE, '').trim()
}

export function stampCurriculumOriginalBody(markdown: string | null | undefined): string {
  const body = stripCurriculumOriginalBodyMarker(markdown)
  if (!body) return body
  return `${CURRICULUM_ORIGINAL_BODY_MARKER}\n${body}`
}

/** Điều kiện SQL: chỉ khớp giáo án soạn theo mạch kiến thức, không khớp bản cache chép sách. */
export const CURRICULUM_ORIGINAL_BODY_SQL = `position('curriculum-body-policy:original-knowledge' in content_markdown) > 0`

/** Ý kiến thức ngắn. Bỏ câu dài, đề bài, lời giải. */
export function normalizeKnowledgePoints(raw: unknown, limit = 12): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const text = String(item ?? '').replace(/\s+/g, ' ').trim()
    if (text.length < 2 || text.length > 80) continue
    if (/lời giải|đáp án|bài tập\s*\d|trang\s*\d|hình\s*\d/i.test(text)) continue
    if (!out.includes(text)) out.push(text)
    if (out.length >= limit) break
  }
  return out
}

export function curriculumOriginalLessonRules(minutes: number, subjectId?: string | null): string {
  const mathRules = String(subjectId || '').trim().toLowerCase() === 'toan' ? `\n${CURRICULUM_MATH_CHECK_RULES}` : ''
  return `Ràng buộc bắt buộc:
- Bám mạch kiến thức của bài theo chuẩn GDPT 2018 và Công văn 5512: đúng ý cần dạy, đúng thứ tự ý.
- Mỗi tiết gồm 4 hoạt động: Khởi động, Hình thành kiến thức, Luyện tập, Vận dụng.
- Chia rõ thời lượng từng phần, tổng mỗi tiết = ${minutes} phút.
- Viết bằng lời giáo án, đủ sâu để giáo viên dạy trọn tiết. Có mục tiêu cụ thể, kiến thức trọng tâm, câu hỏi gợi mở.
- Ví dụ minh họa và bài tập luyện tập là bài mới cùng dạng, do bạn đặt. Lời giải ngắn do bạn viết cho chính bài đó.
- Không chép câu chữ, đề, số liệu, hình hay lời giải mẫu in trong sách. Không ghi số trang, số bài tập của sách, không trích đoạn sách.
- Cuối phần luyện tập có thể nhắc một dòng: học sinh làm bài in trong sách trên sách.
- Dùng tiếng Việt, ký hiệu Unicode, không LaTeX.${mathRules}`
}
