'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizeTopicForSearch, topicsMatch } from './lib/topic-normalize'
import { normalizeCurriculumInput } from './lib/curriculum-input-normalize'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'
import { questionsToMarkdown } from './lib/questions-to-markdown'
import { parseWorksheetIntoBlocks } from './lib/worksheet-parse-questions'
import { blocksToContentJson } from './lib/markdown-to-questions'

const TEXTBOOK_NAMES: Record<string, string> = {
  'ket-noi-tri-thuc': 'Kết nối tri thức với cuộc sống',
  'canh-dieu': 'Cánh diều',
  'chan-troi-sang-tao': 'Chân trời sáng tạo',
  khac: 'Không chỉ định',
}

const LESSON_TYPE_NAMES: Record<string, string> = {
  'hinh-thanh-kien-thuc': 'Bài hình thành kiến thức mới (Lý thuyết)',
  'luyen-tap': 'Bài luyện tập / Ôn tập',
  'thuc-hanh': 'Bài thực hành',
}

const SUBJECT_NAMES: Record<string, string> = {
  toan: 'Toán học',
  'ngu-van': 'Ngữ văn',
  'tieng-anh': 'Tiếng Anh',
  'vat-ly': 'Vật lý',
  'hoa-hoc': 'Hóa học',
  'sinh-hoc': 'Sinh học',
  'lich-su': 'Lịch sử',
  'dia-ly': 'Địa lý',
  gdcd: 'Giáo dục công dân',
  'tin-hoc': 'Tin học',
  'cong-nghe': 'Công nghệ',
  'am-nhac': 'Âm nhạc',
  'my-thuat': 'Mỹ thuật',
  'the-duc': 'Thể dục',
  khac: 'Khác',
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function normalizeBookIsbn(raw: string | undefined | null): string {
  return String(raw || '').replace(/[^0-9Xx]/g, '').toUpperCase().trim()
}

function isValidBookIsbn(isbn: string): boolean {
  // Accept ISBN-10 or ISBN-13 after normalization.
  return /^[0-9]{9}[0-9X]$/.test(isbn) || /^[0-9]{13}$/.test(isbn)
}

function topicTokens(input: string): string[] {
  const normalized = normalizeTopicForSearch(input)
  if (!normalized) return []
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

function tokenJaccard(a: string[], b: string[]): number {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter += 1
  const union = new Set([...sa, ...sb]).size
  return union > 0 ? inter / union : 0
}

type TopicMatchCandidate = { id: string; topic: string; score: number }

async function rerankTopicCandidatesByAI(
  rawTopic: string,
  candidates: Array<{ id: string; topic: string }>
): Promise<Array<{ id: string; score: number }>> {
  try {
    if (!process.env.GOOGLE_API_KEY) return []
    if (!rawTopic.trim() || candidates.length === 0) return []
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    })
    const compact = candidates.map((c) => ({ id: c.id, topic: c.topic }))
    const prompt = `Bạn là bộ chấm độ tương đồng chủ đề giáo trình.
Nhiệm vụ: chấm điểm mức "cùng chủ đề dạy học" giữa chủ đề giáo viên nhập và danh sách giáo trình.
Cho phép khác từ vựng/cách diễn đạt nhưng cùng ý nghĩa chuyên môn.

Chủ đề nhập:
${rawTopic}

Danh sách ứng viên JSON:
${JSON.stringify(compact)}

Trả về JSON đúng schema:
{
  "matches": [
    { "id": "string", "score": 0.0-1.0 }
  ]
}

Ràng buộc:
- score >= 0.80: gần như cùng chủ đề
- 0.60..0.79: tương đối gần
- <0.60: không đủ gần
- Chỉ trả về id có trong danh sách.`
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    if (!text) return []
    const parsed = JSON.parse(text) as { matches?: Array<{ id?: string; score?: number }> }
    const validIds = new Set(candidates.map((c) => c.id))
    return (parsed.matches ?? [])
      .map((m) => ({
        id: String(m.id || '').trim(),
        score: Math.max(0, Math.min(1, Number(m.score || 0))),
      }))
      .filter((m) => validIds.has(m.id))
      .sort((a, b) => b.score - a.score)
  } catch {
    return []
  }
}

/** Lấy câu hỏi có sẵn từ ngân hàng (VNHSGE, Bộ GD). Nếu lessonTopics có ≥1 phần tử thì lọc theo topic khớp. */
async function getOfficialQuestions(
  supabase: ReturnType<typeof createClient>,
  subjectId: string,
  gradeLevelId: string,
  limit: number = 5,
  lessonTopics?: string[]
) {
  let q = supabase
    .from('worksheet_official_questions')
    .select('question_text, options, correct_index')
    .eq('subject_id', subjectId)
    .eq('grade_level_id', gradeLevelId)

  if (lessonTopics && lessonTopics.length >= 1) {
    q = q.not('topic_normalized', 'is', null).in('topic_normalized', lessonTopics)
  }

  const { data } = await q.limit(limit * 5)
  if (!data || data.length === 0) return []
  // Loại câu yêu cầu nhìn hình – phiếu không có hình
  const noImageRe = /hình bên|đồ thị trong hình|đường cong trong hình/i
  const filtered = data.filter((r) => !noImageRe.test(String(r.question_text ?? '')))
  const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, limit)
  return shuffled
}

/** Format câu hỏi ngân hàng để chèn vào giáo trình (trong phần Luyện tập). */
function formatOfficialQuestionsForCurriculum(questions: Array<{ question_text: string; options: string[]; correct_index: number }>) {
  const lines: string[] = ['**Câu hỏi trắc nghiệm (ngân hàng Bộ GD):**', '']
  const answers: string[] = []
  questions.forEach((q, i) => {
    const opts = Array.isArray(q.options) ? q.options : []
    const idx = Math.min(q.correct_index, opts.length - 1)
    const label = OPTION_LABELS[idx] ?? String(idx + 1)
    answers.push(`${i + 1}. ${label}`)
    lines.push(`${i + 1}. ${q.question_text}`)
    opts.forEach((opt, j) => {
      lines.push(`   ${OPTION_LABELS[j] ?? String(j + 1)}. ${opt}`)
    })
    lines.push('')
  })
  lines.push('*Đáp án:* ' + answers.join(', '))
  return lines.join('\n')
}

/** Ghép câu hỏi từ ngân hàng Bộ GD vào phần Luyện tập của mỗi Tiết trong giáo trình. */
async function mergeOfficialQuestionsIntoCurriculum(
  text: string,
  supabase: ReturnType<typeof createClient>,
  subjectId: string,
  gradeLevelId: string,
  lessonTopics: string[]
): Promise<string> {
  const TIET_REGEX = /(^###\s+Tiết\s+\d+[^\n]*$)/im
  const LUYEN_TAP_REGEX = /\*\*3\.\s*Luyện tập\s*\([^)]*\)\*\*\s*\n/
  const parts = text.split(TIET_REGEX)
  if (parts.length < 3) return text

  const merged: string[] = [parts[0]]
  for (let i = 1; i < parts.length; i += 2) {
    const tietHeader = parts[i] ?? ''
    let block = parts[i + 1] ?? ''
    const tiếtTopics = lessonTopics.length >= 1 ? lessonTopics : []
    const questions = tiếtTopics.length >= 1
      ? await getOfficialQuestions(supabase, subjectId, gradeLevelId, 2, tiếtTopics)
      : null
    if (questions && questions.length >= 1) {
      const quizBlock = '\n\n' + formatOfficialQuestionsForCurriculum(questions) + '\n\n'
      block = block.replace(LUYEN_TAP_REGEX, (m) => m + quizBlock)
    }
    merged.push(tietHeader, block)
  }
  return merged.join('')
}

/** AI trích tối đa 5 chủ đề từ nội dung giáo trình – dùng để khớp câu hỏi (khớp 1 trong 5 là ok). */
async function extractLessonTopicsFromContent(
  content: string,
  genAI: GoogleGenerativeAI
): Promise<string[]> {
  try {
    const prompt = `Trích từ giáo trình dưới đây tối đa 5 chủ đề/kiến thức chính (mỗi topic 1-5 từ, tiếng Việt, cụ thể không chung chung).
Ví dụ: Nguyên hàm, Tích phân, Ứng dụng tích phân, Đạo hàm, Cực trị hàm số.

GIÁO TRÌNH:
---
${content.slice(0, 6000)}
---

Trả về JSON: { "topics": ["topic1", "topic2", ...] }
Chỉ trả về JSON, không markdown.`
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    if (!text) return []
    const parsed = JSON.parse(text) as { topics?: string[] }
    const raw = Array.isArray(parsed?.topics) ? parsed.topics : []
    const normalized = raw
      .map((t) => normalizeTopicForSearch(String(t ?? '').trim()))
      .filter((n) => n.length >= 2)
    return Array.from(new Set(normalized)).slice(0, 5)
  } catch {
    return []
  }
}

/** Tạo giáo trình bằng AI cho mọi môn học. Hỗ trợ 2 mode: textbook (gửi ảnh sách), topic.
 * Chuẩn hóa đầu vào trước khi tra DB / tạo. */
export async function createCurriculum(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const createMode = ((formData.get('createMode') as string)?.trim() || 'textbook') as 'textbook' | 'topic'
  const topic = (formData.get('topic') as string)?.trim() || ''
  const goals = (formData.get('goals') as string)?.trim() || ''
  const bookIsbnRaw = (formData.get('bookIsbn') as string)?.trim() || ''
  const bookIsbn = normalizeBookIsbn(bookIsbnRaw)

  const n = normalizeCurriculumInput({
    subjectId: formData.get('subjectId') as string,
    gradeLevelId: formData.get('gradeLevelId') as string,
    textbookSetId: formData.get('textbookSetId') as string,
    textbookVolume: formData.get('textbookVolume') as string,
    lessonNumber: formData.get('lessonNumber') as string,
    numLessons: formData.get('numLessons') as string,
    lessonDurationMinutes: formData.get('lessonDurationMinutes') as string,
    lessonTypeId: formData.get('lessonTypeId') as string,
  })

  const { subjectId, gradeLevelId, textbookSetId, textbookVolume: vol, lessonNumber: lessonNum, numLessons: numTiet, lessonDurationMinutes: thoiLuong, lessonTypeId } = n

  const isTopicMode = createMode === 'topic'

  if (isTopicMode) {
    if (!topic || topic.length < 2) {
      return { error: 'Vui lòng nhập chủ đề (ít nhất 2 ký tự).' }
    }
  } else if (!lessonNum) {
    return { error: 'Vui lòng nhập bài số (1–999).' }
  }
  if (!isTopicMode && textbookSetId === 'khac') {
    if (!bookIsbn) return { error: 'Vui lòng nhập ISBN cho sách khác NXB.' }
    if (!isValidBookIsbn(bookIsbn)) return { error: 'ISBN không hợp lệ (chấp nhận ISBN-10 hoặc ISBN-13).' }
  }

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac
  const lessonTypeName = LESSON_TYPE_NAMES[lessonTypeId] || LESSON_TYPE_NAMES['hinh-thanh-kien-thuc']

  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo giáo trình.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const loadLessonTitleFromDb = async () => {
    if (!lessonNum) return null
    let qLesson = supabase
      .from('worksheet_textbook_lessons')
      .select('title')
      .eq('subject_id', subjectId)
      .eq('grade_level_id', gradeLevelId)
      .eq('textbook_set_id', textbookSetId)
      .eq('lesson_order', lessonNum)
      .limit(1)
    if (vol === '1' || vol === '2') {
      qLesson = qLesson.or(`textbook_volume.eq.${vol},textbook_volume.is.null`)
    } else {
      qLesson = qLesson.is('textbook_volume', null)
    }
    const { data: lessonRow } = await qLesson.maybeSingle()
    return lessonRow?.title ?? null
  }

  let match: { id: string; content_markdown: string } | null = null
  if (!isTopicMode && lessonNum) {
    // Kiểm tra DB: khớp môn + lớp + bộ sách + tập + loại bài + bài số + số tiết + thời gian mỗi tiết
    let qExisting = supabase
      .from('worksheet_curricula')
      .select('id, content_markdown, textbook_volume, lesson_number, textbook_isbn')
      .eq('subject_id', subjectId)
      .eq('grade_level_id', gradeLevelId)
      .eq('textbook_set_id', textbookSetId)
      .eq('lesson_type_id', lessonTypeId)
      .eq('num_lessons', numTiet)
      .eq('lesson_duration_minutes', thoiLuong)
      .limit(100)
    if (textbookSetId === 'khac' && bookIsbn) {
      // For "other publisher", prioritize ISBN to avoid merging different books.
      qExisting = qExisting.eq('textbook_isbn', bookIsbn)
    }
    const { data: existing } = await qExisting

    match = existing?.find((r) => {
      const rVol = (r as { textbook_volume?: string | null }).textbook_volume
      const rNum = (r as { lesson_number?: number | null }).lesson_number
      const rIsbn = normalizeBookIsbn((r as { textbook_isbn?: string | null }).textbook_isbn)
      const volMatch = (vol ?? '') === (rVol ?? '')
      const numMatch = lessonNum === (rNum ?? 0)
      const isbnMatch = textbookSetId !== 'khac' || !bookIsbn || rIsbn === bookIsbn
      return volMatch && numMatch && isbnMatch
    }) ?? null
  }

  if (match) {
    return { success: true, curriculumMarkdown: match.content_markdown ?? '', curriculumId: match.id, matched: true }
  }

  // Tra cứu tên bài từ mục lục SGK trong DB (chỉ mode textbook)
  const lessonTitle: string | null = isTopicMode ? null : await loadLessonTitleFromDb()

  const curriculumMenDeNote = ''

  const prompt = isTopicMode
    ? `Hãy soạn giáo trình cho chủ đề "${topic}", môn ${subjectName}, ${/^lop-\d+$/.test(gradeLevelId) ? gradeLabel : 'cấp ' + gradeLabel}.
${textbookSetId === 'khac' ? `- Sách/nguồn: Không bám sát SGK cụ thể – tạo giáo trình theo chủ đề, phù hợp chương trình giáo dục Việt Nam.` : `- Bộ sách tham khảo: ${textbookName} (nếu có nội dung liên quan).`}

LOẠI BÀI HỌC: ${lessonTypeName}

Thông số:
- Thời lượng: ${numTiet} tiết x ${thoiLuong} phút.
- Đối tượng: Học sinh Việt Nam theo chương trình GDPT 2018.
${goals ? `- Mục tiêu bổ sung: ${goals}` : ''}

CẤU TRÚC BẮT BUỘC (theo Công văn 5512/BGDĐT):
Mỗi tiết gồm 4 hoạt động chính, phân bổ thời gian rõ ràng:
1. Khởi động – kích thích hứng thú, kết nối kiến thức cũ.
2. Hình thành kiến thức – nội dung mới, lý thuyết (hoặc quy trình thí nghiệm nếu là bài thực hành).
3. Luyện tập – vận dụng, bài tập, thực hành.
4. Vận dụng – mở rộng, liên hệ thực tế, đánh giá.

FORMAT BẮT BUỘC:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN CHỦ ĐỀ VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${thoiLuong} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)** – tổng 4 hoạt động = ${thoiLuong} phút.
- Trong mỗi hoạt động, tách thành CÁC PHẦN – mỗi phần ghi rõ thời lượng: **Phần 1 (X phút):**, **Phần 2 (X phút):**, ...

YÊU CẦU CHI TIẾT:
- CÔNG THỨC – CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG dùng LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2 hoặc ½. Căn: √(x+1).
- ĐỘ CHI TIẾT: Mỗi hoạt động chia thành các phần (Phần 1, Phần 2, ...), mỗi phần gọn một ý – ví dụ một ví dụ, một bài tập – không gộp nhiều ý vào một đoạn dài. Mỗi phần phải ghi cụ thể thời lượng (phút).

Yêu cầu:
- Chuẩn Bộ GD&ĐT: Công văn 5512, GDPT 2018.
- Trả về Markdown, dùng ## ### ** - cho cấu trúc.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không có lời giải thích thêm.
- QUAN TRỌNG: Kết quả cho học sinh đọc trực tiếp – dùng Unicode, không LaTeX.`
    : `Hãy soạn giáo trình cho Bài ${lessonNum}, môn ${subjectName}, ${gradeLabel}, bộ sách ${textbookName}.

LOẠI BÀI HỌC: ${lessonTypeName}

Thông số:
- Thời lượng: ${numTiet} tiết x ${thoiLuong} phút.
- Đối tượng: Học sinh Việt Nam theo chương trình GDPT 2018.
- Bộ sách: ${textbookName} – nội dung và thứ tự bài học phải khớp với bộ sách này.
${goals ? `- Mục tiêu bổ sung: ${goals}` : ''}

CẤU TRÚC BẮT BUỘC (theo Công văn 5512/BGDĐT):
Mỗi tiết gồm 4 hoạt động chính, phân bổ thời gian rõ ràng:
1. Khởi động – kích thích hứng thú, kết nối kiến thức cũ.
2. Hình thành kiến thức – nội dung mới, lý thuyết (hoặc quy trình thí nghiệm nếu là bài thực hành).
3. Luyện tập – vận dụng, bài tập, thực hành.
4. Vận dụng – mở rộng, liên hệ thực tế, đánh giá.

FORMAT BẮT BUỘC:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN BÀI VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${thoiLuong} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)** – tổng 4 hoạt động = ${thoiLuong} phút.
- Trong mỗi hoạt động, tách thành CÁC PHẦN – mỗi phần ghi rõ thời lượng: **Phần 1 (X phút):**, **Phần 2 (X phút):**, ... Tổng thời lượng các phần trong mỗi hoạt động phải bằng thời lượng hoạt động đó.
- Ghi rõ tham chiếu SGK: trang X, Hình X, Ví dụ X, HĐX (Hoạt động), Luyện tập X, Vận dụng X, Bài tập X

YÊU CẦU CHI TIẾT (chuẩn Bộ GD&ĐT):
- HÌNH ẢNH: Mỗi Hình X phải mô tả nội dung (đồ thị, bảng, sơ đồ...) để người đọc hiểu.
- CÔNG THỨC – CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG dùng LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2 hoặc ½. Căn: √(x+1). Bảng: dùng +∞, −∞, ‖ (tiệm cận).
- BẢNG: Trích nội dung bảng quan trọng trong SGK, dùng ký hiệu Unicode.
- ĐỘ CHI TIẾT: Mỗi hoạt động chia thành các phần (Phần 1, Phần 2, ...), mỗi phần gọn một ý – ví dụ một ví dụ, một bài tập – không gộp nhiều ý vào một đoạn dài. Mỗi phần phải ghi cụ thể thời lượng (phút), ví dụ: **Phần 1 (5 phút):** ...

Lưu ý theo loại bài:
- Bài hình thành kiến thức mới: tập trung lý thuyết + thí nghiệm minh họa.
- Bài luyện tập/Ôn tập: tập trung phương pháp giải bài tập, hệ thống hóa.
- Bài thực hành: tập trung quy trình thí nghiệm, an toàn, báo cáo.
${curriculumMenDeNote}

Yêu cầu:
- Bám sát 100% nội dung sách giáo khoa – không thêm bớt, không sai lệch.
- Chuẩn Bộ GD&ĐT: Công văn 5512, GDPT 2018.
- Trả về Markdown, dùng ## ### ** - cho cấu trúc.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không có lời giải thích thêm.
- QUAN TRỌNG: Kết quả cho học sinh đọc trực tiếp – dùng Unicode, không LaTeX.`

  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return { error: 'Thiếu GOOGLE_API_KEY. Vui lòng cấu hình API.' }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_PRO)
    const genResult = await model.generateContent(prompt)
    let text = genResult.response.text()?.trim() || ''
    if (!text) return { error: 'AI không trả về nội dung.' }

    const lessonTopics = await extractLessonTopicsFromContent(text, genAI)
    if (lessonTopics.length >= 1) {
      text = await mergeOfficialQuestionsIntoCurriculum(text, supabase, subjectId, gradeLevelId, lessonTopics)
    }

    const topicFinal = isTopicMode ? topic : (topic.trim() ? topic : (lessonTitle ?? `Bài ${lessonNum}`))

    const { data: row, error: insertErr } = await supabase
      .from('worksheet_curricula')
      .insert({
        user_id: user?.id ?? null,
        topic: topicFinal,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        textbook_set_id: isTopicMode ? 'khac' : textbookSetId,
        textbook_volume: isTopicMode ? null : vol,
        textbook_isbn: isTopicMode ? null : (textbookSetId === 'khac' ? bookIsbn : null),
        lesson_number: isTopicMode ? null : lessonNum,
        lesson_type_id: lessonTypeId,
        num_lessons: numTiet,
        lesson_duration_minutes: thoiLuong,
        goals: goals.trim() || null,
        content_markdown: text,
        lesson_topics: lessonTopics.length >= 1 ? lessonTopics : null,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.warn('[createCurriculum] Insert failed:', insertErr.message)
      return { success: true, curriculumMarkdown: text, curriculumId: null, saveFailed: insertErr.message }
    }
    return { success: true, curriculumMarkdown: text, curriculumId: row?.id ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Tạo giáo trình thất bại: ${msg}` }
  }
}

/** Lưu giáo trình vào kho (tạo mới hoặc cập nhật khi có curriculumId).
 * Chuẩn hóa đầu vào trước khi lưu. */
export async function saveCurriculum(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ.' }
  }
  const curriculumMarkdown = (formData.get('curriculumMarkdown') as string)?.trim() || ''
  const topic = (formData.get('topic') as string)?.trim() || ''
  const goals = (formData.get('goals') as string)?.trim() || ''
  const curriculumId = (formData.get('curriculumId') as string)?.trim() || null
  const bookIsbn = normalizeBookIsbn((formData.get('bookIsbn') as string)?.trim() || '')

  const n = normalizeCurriculumInput({
    subjectId: formData.get('subjectId') as string,
    gradeLevelId: formData.get('gradeLevelId') as string,
    textbookSetId: formData.get('textbookSetId') as string,
    textbookVolume: formData.get('textbookVolume') as string,
    lessonNumber: formData.get('lessonNumber') as string,
    numLessons: formData.get('numLessons') as string,
    lessonDurationMinutes: formData.get('lessonDurationMinutes') as string,
    lessonTypeId: formData.get('lessonTypeId') as string,
  })

  const { subjectId, gradeLevelId, textbookSetId, textbookVolume: vol, lessonNumber: lessonNum, numLessons: numTiet, lessonDurationMinutes: thoiLuong, lessonTypeId } = n

  if (!curriculumMarkdown) {
    return { error: 'Thiếu nội dung giáo trình.' }
  }
  // Cho phép lưu theo chủ đề (topic) khi không có bài số – dùng topic làm tiêu đề
  if (!lessonNum && !topic) {
    return { error: 'Thiếu bài số hoặc chủ đề.' }
  }

  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu giáo trình.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const topicFinal = topic || `Bài ${lessonNum}`
  if (textbookSetId === 'khac' && lessonNum) {
    if (!bookIsbn) return { error: 'Vui lòng nhập ISBN cho sách khác NXB.' }
    if (!isValidBookIsbn(bookIsbn)) return { error: 'ISBN không hợp lệ (chấp nhận ISBN-10 hoặc ISBN-13).' }
  }

  // Chỉ trích lesson_topics khi TẠO MỚI (không có curriculumId) – tránh gọi AI mỗi lần "Lưu thay đổi"
  let lessonTopics: string[] | null = null
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!curriculumId && apiKey && curriculumMarkdown.length >= 100) {
    const genAI = new GoogleGenerativeAI(apiKey)
    const extracted = await extractLessonTopicsFromContent(curriculumMarkdown, genAI)
    lessonTopics = extracted.length >= 5 ? extracted : null
  }

  if (curriculumId) {
    const { error: updErr } = await supabase
      .from('worksheet_curricula')
      .update({
        topic: topicFinal,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        textbook_set_id: lessonNum ? textbookSetId : 'khac',
        textbook_volume: lessonNum ? vol : null,
        textbook_isbn: lessonNum && textbookSetId === 'khac' ? bookIsbn : null,
        lesson_number: lessonNum,
        lesson_type_id: lessonTypeId,
        num_lessons: numTiet,
        lesson_duration_minutes: thoiLuong,
        goals: goals || null,
        content_markdown: curriculumMarkdown,
        ...(lessonTopics ? { lesson_topics: lessonTopics } : {}),
      })
      .eq('id', curriculumId)
    if (updErr) return { error: `Cập nhật thất bại: ${updErr.message}` }
    return { success: true, curriculumId }
  }

  const { data: row, error } = await supabase
    .from('worksheet_curricula')
    .insert({
      user_id: user?.id ?? null,
      topic: topicFinal,
      subject_id: subjectId,
      grade_level_id: gradeLevelId,
      textbook_set_id: lessonNum ? textbookSetId : 'khac',
      textbook_volume: lessonNum ? vol : null,
      textbook_isbn: lessonNum && textbookSetId === 'khac' ? bookIsbn : null,
      lesson_number: lessonNum,
      lesson_type_id: lessonTypeId,
      num_lessons: numTiet,
      lesson_duration_minutes: thoiLuong,
      goals: goals || null,
      content_markdown: curriculumMarkdown,
      lesson_topics: lessonTopics,
    })
    .select('id')
    .single()

  if (error) return { error: `Lưu thất bại: ${error.message}` }
  return { success: true, curriculumId: row?.id ?? null }
}

/** Lưu số bài + tên bài vào mục lục SGK khi tạo giáo trình từ ảnh – để giáo viên khác nhập đúng số bài là thấy nút Xem giáo trình */
export async function saveTextbookLessonFromImage(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonNumber: number
  lessonTitle: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { subjectId, gradeLevelId, textbookSetId, lessonNumber, lessonTitle } = opts
  if (!lessonTitle?.trim() || lessonNumber < 1 || lessonNumber > 999) return { success: true }

  const title = lessonTitle.trim()
  const titleNormalized = normalizeTopicForSearch(title) || title.toLowerCase().replace(/\s+/g, ' ').trim()

  const { data: existing } = await supabase
    .from('worksheet_textbook_lessons')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('grade_level_id', gradeLevelId)
    .eq('textbook_set_id', textbookSetId)
    .eq('lesson_order', lessonNumber)
    .is('textbook_volume', null)
    .limit(1)
    .maybeSingle()

  if (existing) return { success: true }

  await supabase.from('worksheet_textbook_lessons').insert({
    subject_id: subjectId,
    grade_level_id: gradeLevelId,
    textbook_set_id: textbookSetId,
    lesson_order: lessonNumber,
    title,
    title_normalized: titleNormalized,
  })
  return { success: true }
}

/** Kiểm tra DB đã có giáo trình khớp (môn + lớp + bộ sách + tập + loại bài + bài số + số tiết + thời gian) chưa.
 * Chuẩn hóa đầu vào trước khi tra để khớp với DB. */
export async function checkCurriculumExists(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
  bookIsbn?: string
  lessonNumber?: number
  numLessons: number
  lessonDurationMinutes: number
  lessonTypeId?: string
  createMode?: 'textbook' | 'topic'
  topic?: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const normalizedIsbn = normalizeBookIsbn(opts.bookIsbn)
  const n = normalizeCurriculumInput({
    subjectId: opts.subjectId,
    gradeLevelId: opts.gradeLevelId,
    textbookSetId: opts.textbookSetId,
    textbookVolume: opts.textbookVolume,
    lessonNumber: opts.lessonNumber,
    numLessons: opts.numLessons,
    lessonDurationMinutes: opts.lessonDurationMinutes,
    lessonTypeId: opts.lessonTypeId,
  })

  const isTopicMode = opts.createMode === 'topic'
  if (isTopicMode) {
    const rawTopic = String(opts.topic || '').trim()
    const normalizedInput = normalizeTopicForSearch(rawTopic)
    if (!normalizedInput || normalizedInput.length < 2) return { exists: false, similarItems: [] as TopicMatchCandidate[] }

    // Layer 1: fast candidate filtering by subject/grade and lexical similarity.
    const { data: topicRows } = await supabase
      .from('worksheet_curricula')
      .select('id, topic, created_at')
      .eq('subject_id', n.subjectId)
      .eq('grade_level_id', n.gradeLevelId)
      .is('lesson_number', null)
      .order('created_at', { ascending: false })
      .limit(80)

    const inputTokens = topicTokens(rawTopic)
    const lexicalCandidates: TopicMatchCandidate[] = (topicRows ?? [])
      .map((r) => {
        const candidateTopic = String((r as { topic?: string | null }).topic || '').trim()
        const tks = topicTokens(candidateTopic)
        const exactLike = topicsMatch(rawTopic, candidateTopic) ? 1 : 0
        const jacc = tokenJaccard(inputTokens, tks)
        const lenPenalty = Math.abs(inputTokens.length - tks.length) > 6 ? 0.1 : 0
        const score = Math.max(0, Math.min(1, exactLike * 0.65 + jacc * 0.5 - lenPenalty))
        return { id: (r as { id: string }).id, topic: candidateTopic, score }
      })
      .filter((x) => x.topic.length >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    if (lexicalCandidates.length === 0) return { exists: false, similarItems: [] as TopicMatchCandidate[] }

    // Layer 2: semantic rerank via AI.
    const aiScores = await rerankTopicCandidatesByAI(
      rawTopic,
      lexicalCandidates.map((c) => ({ id: c.id, topic: c.topic }))
    )
    const aiMap = new Map(aiScores.map((x) => [x.id, x.score]))
    const merged = lexicalCandidates
      .map((c) => {
        const ai = aiMap.get(c.id)
        const score = ai == null ? c.score : Math.max(0, Math.min(1, c.score * 0.35 + ai * 0.65))
        return { ...c, score }
      })
      .sort((a, b) => b.score - a.score)

    const similarItems = merged.filter((x) => x.score >= 0.6).slice(0, 5)
    const best = similarItems[0]
    if (best && best.score >= 0.8) {
      const { data: bestRow } = await supabase
        .from('worksheet_curricula')
        .select('id, content_markdown, topic')
        .eq('id', best.id)
        .limit(1)
        .maybeSingle()
      return {
        exists: true,
        curriculumId: best.id,
        curriculumMarkdown: (bestRow as { content_markdown?: string | null } | null)?.content_markdown ?? null,
        topic: best.topic,
        similarItems,
      }
    }
    return { exists: false, similarItems }
  }

  if (!n.lessonNumber) return { exists: false }

  let q = supabase
    .from('worksheet_curricula')
    .select('id, content_markdown, topic')
    .eq('subject_id', n.subjectId)
    .eq('grade_level_id', n.gradeLevelId)
    .eq('textbook_set_id', n.textbookSetId)
    .eq('lesson_type_id', n.lessonTypeId)
    .eq('num_lessons', n.numLessons)
    .eq('lesson_duration_minutes', n.lessonDurationMinutes)
    .eq('lesson_number', n.lessonNumber)
    .limit(1)

  if (n.textbookSetId === 'khac') {
    if (!normalizedIsbn) return { exists: false }
    if (!isValidBookIsbn(normalizedIsbn)) return { exists: false }
    q = q.eq('textbook_isbn', normalizedIsbn)
  }

  if (n.textbookVolume === '1' || n.textbookVolume === '2') {
    q = q.eq('textbook_volume', n.textbookVolume)
  } else {
    q = q.is('textbook_volume', null)
  }

  const { data } = await q
  const row = data?.[0]
  if (row) {
    return { exists: true, curriculumId: row.id, curriculumMarkdown: row.content_markdown, topic: row.topic }
  }
  return { exists: false }
}

/** Danh sách bài học chuẩn SGK – để giáo viên chọn, không gõ tay */
export async function listTextbookLessons(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  try {
    let q = supabase
      .from('worksheet_textbook_lessons')
      .select('id, title, lesson_order, chapter_label')
      .eq('subject_id', opts.subjectId)
      .eq('grade_level_id', opts.gradeLevelId)
      .eq('textbook_set_id', opts.textbookSetId)
      .order('lesson_order', { ascending: true })
    if (opts.textbookVolume === '1' || opts.textbookVolume === '2') {
      q = q.or(`textbook_volume.eq.${opts.textbookVolume},textbook_volume.is.null`)
    }
    const { data, error } = await q
    if (error) return { success: true, items: [] }
    return { success: true, items: data ?? [] }
  } catch {
    return { success: true, items: [] }
  }
}

/** Không còn dùng AI tạo mục lục – chỉ trả về từ DB. Nút "Làm mới" gọi listTextbookLessons. */
export async function refreshTextbookLessonsByAI(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
}) {
  return listTextbookLessons(opts)
}

/** Không dùng AI tạo mục lục nữa. Mục lục chỉ lấy từ DB (đã seed hoặc import thủ công). */
export async function fetchTextbookLessonsByAI(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
}) {
  void opts
  return { error: 'Mục lục không được tạo bằng AI. Vui lòng dùng dữ liệu có sẵn trong DB hoặc import từ nguồn chính thức.' }
}

/** Danh sách giáo trình đã lưu – gồm: (1) giáo trình user tạo, (2) giáo trình user đã mở (kể cả của người khác). Loại trừ user đã ẩn. */
export async function listCurricula(opts?: { subjectId?: string; gradeLevelId?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem danh sách giáo trình.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const hiddenIds: string[] = []
  if (user?.id) {
    const { data: hidden } = await supabase
      .from('user_hidden_curricula')
      .select('curriculum_id')
      .eq('user_id', user.id)
    if (hidden) hiddenIds.push(...hidden.map((r) => r.curriculum_id))
  }

  const limit = Math.min(200, opts?.limit ?? 200)

  // 1. Giáo trình do user tạo
  let qOwn = supabase
    .from('worksheet_curricula')
    .select('id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opts?.subjectId) qOwn = qOwn.eq('subject_id', opts.subjectId)
  if (opts?.gradeLevelId) qOwn = qOwn.eq('grade_level_id', opts.gradeLevelId)
  if (hiddenIds.length > 0) qOwn = qOwn.not('id', 'in', `(${hiddenIds.join(',')})`)

  const { data: ownData, error } = await qOwn
  if (error) return { error: error.message }
  const ownItems = (ownData ?? []) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>

  // 2. Giáo trình user đã mở (từ user_opened_curricula) – kể cả của người khác
  const ownIds = new Set(ownItems.map((c) => c.id))
  let openedItems: typeof ownItems = []
  if (user?.id) {
    const { data: openedRows } = await supabase
      .from('user_opened_curricula')
      .select('curriculum_id, opened_at')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (openedRows?.length) {
      const openedIds = openedRows.map((r) => r.curriculum_id).filter((id) => !ownIds.has(id) && !hiddenIds.includes(id))
      if (openedIds.length > 0) {
        let qOpened = supabase
          .from('worksheet_curricula')
          .select('id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, created_at')
          .in('id', openedIds)

        if (opts?.subjectId) qOpened = qOpened.eq('subject_id', opts.subjectId)
        if (opts?.gradeLevelId) qOpened = qOpened.eq('grade_level_id', opts.gradeLevelId)

        const { data: openedData } = await qOpened
        openedItems = (openedData ?? []) as typeof ownItems
        const openedOrder = new Map(openedRows.map((r) => [r.curriculum_id, r.opened_at]))
        openedItems.sort((a, b) => {
          const ta = openedOrder.get(a.id) ?? ''
          const tb = openedOrder.get(b.id) ?? ''
          return tb.localeCompare(ta)
        })
      }
    }
  }

  const items = [...openedItems, ...ownItems]

  // Bổ sung tên bài từ mục lục SGK cho giáo trình có lesson_number nhưng topic chỉ là "Bài X"
  const needEnrich = items.filter(
    (c) =>
      (c as { lesson_number?: number | null }).lesson_number != null &&
      !(c.topic ?? '').includes(': ')
  ) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null }>
  if (needEnrich.length > 0) {
    const lessonOrders = Array.from(new Set(needEnrich.map((c) => c.lesson_number!)))
    const subjectIds = Array.from(new Set(needEnrich.map((c) => c.subject_id)))
    const gradeIds = Array.from(new Set(needEnrich.map((c) => c.grade_level_id)))
    const textbookIds = Array.from(new Set(needEnrich.map((c) => c.textbook_set_id).filter(Boolean) as string[]))
    if (subjectIds.length && gradeIds.length && textbookIds.length) {
      const { data: lessons } = await supabase
        .from('worksheet_textbook_lessons')
        .select('subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_order, title')
        .in('subject_id', subjectIds)
        .in('grade_level_id', gradeIds)
        .in('textbook_set_id', textbookIds)
        .in('lesson_order', lessonOrders)

      const titleMap = new Map<string, string>()
      for (const l of lessons ?? []) {
        const vol = l.textbook_volume ?? ''
        const key = `${l.subject_id}|${l.grade_level_id}|${l.textbook_set_id}|${l.lesson_order}|${vol}`
        if (!titleMap.has(key)) titleMap.set(key, l.title)
      }

      for (const c of items) {
        const r = c as { lesson_number?: number | null; textbook_volume?: string | null; textbook_set_id?: string }
        const num = r.lesson_number
        if (num == null || (c.topic ?? '').includes(': ')) continue
        const vol = r.textbook_volume ?? ''
        const key = `${c.subject_id}|${c.grade_level_id}|${r.textbook_set_id ?? ''}|${num}|${vol}`
        const title = titleMap.get(key)
        if (title) (c as { topic: string }).topic = title
      }
    }
  }

  return { success: true, items }
}

/** Ghi nhận giáo viên đã mở giáo trình – dùng khi load/xem giáo trình trong tao-giao-trinh */
export async function recordCurriculumOpen(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult
  if (!user?.id) return { success: true }

  await supabase
    .from('user_opened_curricula')
    .upsert(
      { user_id: user.id, curriculum_id: curriculumId, opened_at: new Date().toISOString() },
      { onConflict: 'user_id,curriculum_id' }
    )
  return { success: true }
}

/** Danh sách giáo trình đã mở – hiển thị ở trên cùng khi chọn giáo trình cho bài thi */
export async function listOpenedCurriculaForExam(opts?: { subjectId?: string; gradeLevelId?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult
  if (!user?.id) return { success: true, items: [] }

  const hiddenIds: string[] = []
  const { data: hidden } = await supabase
    .from('user_hidden_curricula')
    .select('curriculum_id')
    .eq('user_id', user.id)
  if (hidden) hiddenIds.push(...hidden.map((r) => r.curriculum_id))

  const q = supabase
    .from('user_opened_curricula')
    .select('curriculum_id, opened_at')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false })
    .limit(Math.min(50, opts?.limit ?? 30))

  const { data: openedRows, error } = await q
  if (error || !openedRows?.length) return { success: true, items: [] }

  const curriculumIds = openedRows.map((r) => r.curriculum_id)
  let qCurr = supabase
    .from('worksheet_curricula')
    .select('id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, created_at, user_id')
    .in('id', curriculumIds)

  if (opts?.subjectId) qCurr = qCurr.eq('subject_id', opts.subjectId)
  if (opts?.gradeLevelId) qCurr = qCurr.eq('grade_level_id', opts.gradeLevelId)
  if (hiddenIds.length > 0) qCurr = qCurr.not('id', 'in', `(${hiddenIds.join(',')})`)

  const { data: curricula, error: currErr } = await qCurr
  if (currErr || !curricula?.length) return { success: true, items: [] }

  const needEnrich = curricula.filter(
    (c) => (c as { lesson_number?: number | null }).lesson_number != null && !(c.topic ?? '').includes(': ')
  )
  if (needEnrich.length > 0) {
    const lessonOrders = Array.from(new Set(needEnrich.map((c) => (c as { lesson_number?: number }).lesson_number!)))
    const subjectIds = Array.from(new Set(needEnrich.map((c) => c.subject_id)))
    const gradeIds = Array.from(new Set(needEnrich.map((c) => c.grade_level_id)))
    const textbookIds = Array.from(new Set(needEnrich.map((c) => (c as { textbook_set_id?: string }).textbook_set_id).filter(Boolean) as string[]))
    if (subjectIds.length && gradeIds.length && textbookIds.length) {
      const { data: lessons } = await supabase
        .from('worksheet_textbook_lessons')
        .select('subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_order, title')
        .in('subject_id', subjectIds)
        .in('grade_level_id', gradeIds)
        .in('textbook_set_id', textbookIds)
        .in('lesson_order', lessonOrders)
      const titleMap = new Map<string, string>()
      for (const l of lessons ?? []) {
        const vol = l.textbook_volume ?? ''
        const key = `${l.subject_id}|${l.grade_level_id}|${l.textbook_set_id}|${l.lesson_order}|${vol}`
        if (!titleMap.has(key)) titleMap.set(key, l.title)
      }
      for (const c of curricula) {
        const r = c as { lesson_number?: number | null; textbook_volume?: string | null; textbook_set_id?: string }
        const num = r.lesson_number
        if (num == null || (c.topic ?? '').includes(': ')) continue
        const vol = r.textbook_volume ?? ''
        const key = `${c.subject_id}|${c.grade_level_id}|${r.textbook_set_id ?? ''}|${num}|${vol}`
        const title = titleMap.get(key)
        if (title) (c as { topic: string }).topic = title
      }
    }
  }

  const ordered = curriculumIds
    .map((id) => curricula.find((c) => c.id === id))
    .filter(Boolean) as typeof curricula
  const enriched = ordered.map((c) => ({
    ...c,
    isOwn: c.user_id === user?.id,
    isOpened: true,
  }))
  return { success: true, items: enriched }
}

/** Danh sách giáo trình cho Tạo bài thi – lấy chung từ mọi giáo viên (RLS cho phép xem tất cả). */
export async function listCurriculaForExam(opts?: { subjectId?: string; gradeLevelId?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const hiddenIds: string[] = []
  if (user?.id) {
    const { data: hidden } = await supabase
      .from('user_hidden_curricula')
      .select('curriculum_id')
      .eq('user_id', user.id)
    if (hidden) hiddenIds.push(...hidden.map((r) => r.curriculum_id))
  }

  const limit = Math.min(100, opts?.limit ?? 100)

  let q = supabase
    .from('worksheet_curricula')
    .select('id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opts?.subjectId) q = q.eq('subject_id', opts.subjectId)
  if (opts?.gradeLevelId) q = q.eq('grade_level_id', opts.gradeLevelId)
  if (hiddenIds.length > 0) q = q.not('id', 'in', `(${hiddenIds.join(',')})`)

  const { data, error } = await q
  if (error) return { error: error.message }
  const items = (data ?? []) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; user_id?: string | null }>

  const needEnrich = items.filter(
    (c) => c.lesson_number != null && !(c.topic ?? '').includes(': ')
  )
  if (needEnrich.length > 0) {
    const lessonOrders = Array.from(new Set(needEnrich.map((c) => c.lesson_number!)))
    const subjectIds = Array.from(new Set(needEnrich.map((c) => c.subject_id)))
    const gradeIds = Array.from(new Set(needEnrich.map((c) => c.grade_level_id)))
    const textbookIds = Array.from(new Set(needEnrich.map((c) => c.textbook_set_id).filter(Boolean) as string[]))
    if (subjectIds.length && gradeIds.length && textbookIds.length) {
      const { data: lessons } = await supabase
        .from('worksheet_textbook_lessons')
        .select('subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_order, title')
        .in('subject_id', subjectIds)
        .in('grade_level_id', gradeIds)
        .in('textbook_set_id', textbookIds)
        .in('lesson_order', lessonOrders)
      const titleMap = new Map<string, string>()
      for (const l of lessons ?? []) {
        const vol = l.textbook_volume ?? ''
        const key = `${l.subject_id}|${l.grade_level_id}|${l.textbook_set_id}|${l.lesson_order}|${vol}`
        if (!titleMap.has(key)) titleMap.set(key, l.title)
      }
      for (const c of items) {
        const num = c.lesson_number
        if (num == null || (c.topic ?? '').includes(': ')) continue
        const vol = c.textbook_volume ?? ''
        const key = `${c.subject_id}|${c.grade_level_id}|${c.textbook_set_id ?? ''}|${num}|${vol}`
        const title = titleMap.get(key)
        if (title) c.topic = title
      }
    }
  }

  const enriched = items.map((c) => ({ ...c, isOwn: c.user_id === user?.id }))
  return { success: true, items: enriched }
}

/** Ẩn giáo trình khỏi danh sách của mình (soft delete) – dữ liệu vẫn lưu DB cho giáo viên khác */
export async function deleteCurriculum(id: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để ẩn giáo trình.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { error } = await supabase
    .from('user_hidden_curricula')
    .upsert(
      { user_id: user!.id, curriculum_id: id },
      { onConflict: 'user_id,curriculum_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}

/** Xóa dữ liệu phát sinh của giáo trình trước khi tạo lại (ghi đè): worksheet + slides + lịch sử chỉnh sửa. */
export async function clearCurriculumDerivedData(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const tasks = [
    admin.from('worksheet_worksheets').delete().eq('curriculum_id', curriculumId),
    admin.from('worksheet_slide_edit_history').delete().eq('curriculum_id', curriculumId),
    admin.from('user_customized_slides_history').delete().eq('curriculum_id', curriculumId),
    admin.from('user_customized_slides').delete().eq('curriculum_id', curriculumId),
    admin.from('worksheet_slides_original').delete().eq('curriculum_id', curriculumId),
    admin.from('worksheet_slides').delete().eq('curriculum_id', curriculumId),
  ] as const

  for (const t of tasks) {
    const { error } = await t
    if (error) return { error: error.message }
  }

  return { success: true }
}

/** Lấy chi tiết giáo trình theo id – cho phép load bất kỳ (kể cả khi match từ giáo viên khác) */
export async function getCurriculumById(id: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_curricula')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return { error: error?.message ?? 'Không tìm thấy giáo trình.' }
  return { success: true, curriculum: data }
}

/** Kiểm tra người dùng hiện tại có phải chủ sở hữu giáo trình không */
export async function isCurriculumOwner(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { success: false, isOwner: false }

  const { data, error } = await supabase
    .from('worksheet_curricula')
    .select('user_id')
    .eq('id', curriculumId)
    .single()

  if (error || !data) return { success: false, isOwner: false }
  const isOwner = (data as { user_id?: string | null }).user_id === authResult.user?.id
  return { success: true, isOwner: !!isOwner }
}

/** Danh sách phiếu bài tập đã lưu */
export async function listWorksheets(opts?: { subjectId?: string; gradeLevelId?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem danh sách phiếu bài tập.')
  if ('error' in authResult) return { error: authResult.error }

  let q = supabase
    .from('worksheet_worksheets')
    .select('id, topic, subject_id, grade_level_id, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(100, opts?.limit ?? 50))

  if (opts?.subjectId) q = q.eq('subject_id', opts.subjectId)
  if (opts?.gradeLevelId) q = q.eq('grade_level_id', opts.gradeLevelId)

  const { data, error } = await q
  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
}

/** Lấy chi tiết phiếu bài tập theo id */
export async function getWorksheetById(id: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return { error: error?.message ?? 'Không tìm thấy phiếu bài tập.' }

  const questionIds = (data.question_ids ?? []) as string[]
  let contentMarkdown = (data.content_markdown ?? '') as string
  if (questionIds.length) {
    const { worksheetDisplayMarkdownFromDb } = await import('./lib/merge-worksheet-content')
    contentMarkdown = await worksheetDisplayMarkdownFromDb(supabase, contentMarkdown, questionIds)
  }
  return { success: true, worksheet: { ...data, content_markdown: contentMarkdown } }
}

/** Cập nhật nội dung phiếu bài tập – đồng bộ cả worksheet_questions để giáo viên khác dùng lại câu đã sửa.
 * Trắc nghiệm và tự luận xử lý giống nhau – parse block → content_json → lưu.
 */
export async function saveWorksheetContent(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ.' }
  }
  const worksheetId = (formData.get('worksheetId') as string)?.trim() || ''
  const contentMarkdown = (formData.get('contentMarkdown') as string)?.trim() || ''
  if (!worksheetId) return { error: 'Thiếu worksheetId.' }
  if (!contentMarkdown) return { error: 'Nội dung phiếu bài tập không được để trống.' }

  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu phiếu bài tập.')
  if ('error' in authResult) return { error: authResult.error }
  const userId = authResult.user?.id ?? null

  const { data: ws, error: fetchErr } = await supabase
    .from('worksheet_worksheets')
    .select('question_ids, user_id, curriculum_id, subject_id, grade_level_id, topic')
    .eq('id', worksheetId)
    .single()

  if (fetchErr) return { error: fetchErr.message }

  const blocks = parseWorksheetIntoBlocks(contentMarkdown)
  const questionIds = (ws?.question_ids ?? []) as string[]
  const qRows = questionIds.length > 0
    ? ((await supabase.from('worksheet_questions').select('id, type').in('id', questionIds)).data ?? [])
    : []
  const ordered = questionIds.map((id) => qRows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string }>
  const toSync = blocksToContentJson(blocks, ordered)

  const newQuestionIds: string[] = []
  for (let i = 0; i < toSync.length; i++) {
    const item = toSync[i]
    if (!item?.content_json) continue

    if (item.id) {
      await supabase.from('worksheet_questions').update({ content_json: item.content_json }).eq('id', item.id)
      newQuestionIds.push(item.id)
    } else {
      const { data: inserted } = await supabase
        .from('worksheet_questions')
        .insert({
          user_id: userId ?? ws?.user_id ?? null,
          curriculum_id: ws?.curriculum_id ?? null,
          type: item.type,
          subject_id: ws?.subject_id ?? 'toan',
          grade_level_id: ws?.grade_level_id ?? 'lop-6',
          topic: ws?.topic ?? null,
          content_json: item.content_json,
          source: 'edited',
          order: newQuestionIds.length,
        })
        .select('id')
        .single()
      if (inserted?.id) newQuestionIds.push(inserted.id)
    }
  }

  const { error } = await supabase
    .from('worksheet_worksheets')
    .update({ content_markdown: contentMarkdown, question_ids: newQuestionIds })
    .eq('id', worksheetId)
  if (error) return { error: error.message }
  return { success: true }
}

/** Merge câu mới vào phiếu có sẵn: trắc nghiệm nối tiếp trắc nghiệm, tự luận nối tiếp tự luận. */
function mergeQuestionIds(
  existingIds: string[],
  existingTypes: Map<string, string>,
  newIds: string[],
  newTypes: Map<string, string>
): string[] {
  const existingQuizzes = existingIds.filter((id) => existingTypes.get(id) === 'quiz')
  const existingEssays = existingIds.filter((id) => existingTypes.get(id) === 'essay')
  const newQuizzes = newIds.filter((id) => newTypes.get(id) === 'quiz')
  const newEssays = newIds.filter((id) => newTypes.get(id) === 'essay')
  return [...existingQuizzes, ...newQuizzes, ...existingEssays, ...newEssays]
}

/** Tạo phiếu bài tập từ danh sách question_ids (câu đã tạo từng câu, verify).
 * Nếu có curriculumId và phiếu có sẵn: nối vào – trắc nghiệm thêm sau trắc nghiệm, tự luận thêm sau tự luận. */
export async function createWorksheetFromQuestions(formData: FormData) {
  const questionIdsRaw = formData.get('questionIds') as string
  const newQuestionIds = (typeof questionIdsRaw === 'string' ? JSON.parse(questionIdsRaw || '[]') : []) as string[]
  const topic = (formData.get('topic') as string)?.trim() || 'Phiếu bài tập'
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  const curriculumId = (formData.get('curriculumId') as string)?.trim() || null

  if (!newQuestionIds.length) return { error: 'Chưa có câu hỏi nào.' }

  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) return { error: auth.error }
  const userId = auth.user?.id

  const { data: newRows, error: fetchErr } = await supabase
    .from('worksheet_questions')
    .select('id, type, content_json, difficulty, source, verified_at')
    .in('id', newQuestionIds)

  if (fetchErr) return { error: fetchErr.message }
  const newOrdered = newQuestionIds.map((id) => newRows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown; difficulty?: string }>
  if (newOrdered.length === 0) return { error: 'Không tìm thấy câu hỏi.' }

  const newTypes: Map<string, string> = new Map(newOrdered.map((r) => [r.id, r.type]))

  let finalIds: string[]
  let contentMarkdown: string

  if (curriculumId) {
    const { data: existingWs } = await supabase
      .from('worksheet_worksheets')
      .select('id, question_ids')
      .eq('curriculum_id', curriculumId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const existingIds = ((existingWs?.question_ids ?? []) as string[]).filter(Boolean)
    if (existingIds.length > 0) {
      const { data: existingRows } = await supabase
        .from('worksheet_questions')
        .select('id, type')
        .in('id', existingIds)
      const existingTypes = new Map((existingRows ?? []).map((r) => [r.id, r.type]))

      finalIds = mergeQuestionIds(existingIds, existingTypes, newQuestionIds, newTypes)
      const { data: allRows } = await supabase
        .from('worksheet_questions')
        .select('id, type, content_json, difficulty, source, verified_at')
        .in('id', finalIds)
      const ordered = finalIds.map((id) => allRows?.find((r) => r.id === id)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown; difficulty?: string }>
      contentMarkdown = questionsToMarkdown(ordered)

      const { error: updateErr } = await supabase
        .from('worksheet_worksheets')
        .update({ content_markdown: contentMarkdown, question_ids: finalIds })
        .eq('id', existingWs!.id)

      if (updateErr) return { error: updateErr.message }
      return { success: true, worksheetId: existingWs!.id, worksheetMarkdown: contentMarkdown }
    }
  }

  finalIds = newQuestionIds
  contentMarkdown = questionsToMarkdown(newOrdered)

  const { data: row, error: insertErr } = await supabase
    .from('worksheet_worksheets')
    .insert({
      user_id: userId,
      curriculum_id: curriculumId || null,
      topic,
      subject_id: subjectId,
      grade_level_id: gradeLevelId,
      content_markdown: contentMarkdown,
      question_ids: finalIds,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }
  return { success: true, worksheetId: row?.id ?? null, worksheetMarkdown: contentMarkdown }
}

/** Lấy danh sách phiếu bài tập thuộc một giáo trình (kể cả khi match từ giáo viên khác) */
export async function getWorksheetsByCurriculumId(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, subject_id, grade_level_id, content_markdown, question_ids, created_at')
    .eq('curriculum_id', curriculumId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  const rows = data ?? []
  const { worksheetDisplayMarkdownFromDb } = await import('./lib/merge-worksheet-content')
  const items = await Promise.all(
    rows.map(async (row) => {
      const qids = (row.question_ids ?? []) as string[]
      const md =
        qids.length > 0
          ? await worksheetDisplayMarkdownFromDb(supabase, row.content_markdown ?? '', qids)
          : (row.content_markdown ?? '')
      const { question_ids: _questionIdsOmit, ...rest } = row as typeof row & { question_ids?: string[] | null }
      void _questionIdsOmit
      return { ...rest, content_markdown: md }
    })
  )
  return { success: true, items }
}

type SlideBlock = { header: string; content: string }
type SlideItem = { title: string; blocks: SlideBlock[]; imageUrl?: string }

const QUIZ_MARKER_RE = /\[quiz:\s*(.+[\x1f|][0-3])\]/gi

/** Trích xuất tất cả marker [quiz:...] từ một slide */
function extractQuizMarkersFromSlide(slide: SlideItem): string[] {
  const markers: string[] = []
  for (const block of slide.blocks ?? []) {
    QUIZ_MARKER_RE.lastIndex = 0
    let m
    while ((m = QUIZ_MARKER_RE.exec(block.content ?? '')) !== null) {
      markers.push(`[quiz:${m[1]}]`)
    }
  }
  return markers
}

/** Áp dụng quiz markers vào slide – thay thế quiz cũ bằng quiz mới, giữ nguyên nội dung khác */
function applyQuizMarkersToSlide(slide: SlideItem, markers: string[]): SlideItem {
  if (markers.length === 0) return slide
  const quizText = markers.join('\n\n')
  const newBlocks = (slide.blocks ?? []).map((b) => ({
    ...b,
    content: (b.content ?? '').replace(/\[quiz:\s*(.+[\x1f|][0-3])\]/gi, '').replace(/\n\s*\n\s*\n/g, '\n\n').trim(),
  })).filter((b) => b.content || b.header)
  if (newBlocks.length > 0) {
    const last = newBlocks[newBlocks.length - 1]
    newBlocks[newBlocks.length - 1] = {
      ...last,
      content: last.content ? last.content + '\n\n' + quizText : quizText,
    }
  } else {
    newBlocks.push({ header: 'Trắc nghiệm', content: quizText })
  }
  return { ...slide, blocks: newBlocks }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientAny = any

type RegionCompareLite = {
  correctVersion: 'original' | 'edited' | 'both'
  originalCorrect: boolean
  editedCorrect: boolean
  originalReason: string | null
  editedReason: string | null
  explanation: string
}

const SLIDE_REGION_PROMPT = `So sánh 2 phiên bản nội dung slide dạy học. Chỉ trả về JSON, không giải thích thêm.

ĐOẠN GỐC:
---
{originalRegion}
---

ĐOẠN MỚI SỬA:
---
{editedRegion}
---

JSON:
{"correctVersion":"original"|"edited"|"both","originalCorrect":bool,"editedCorrect":bool,"originalReason":"lý do nếu sai"|null,"editedReason":"lý do nếu sai"|null,"explanation":"tóm tắt 1 câu"}`

function parseRegionCompareLite(text: string): RegionCompareLite | null {
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*/g, '').trim())
    const correctVersion =
      parsed.correctVersion === 'original' || parsed.correctVersion === 'edited' || parsed.correctVersion === 'both'
        ? parsed.correctVersion
        : 'edited'
    return {
      correctVersion,
      originalCorrect: !!parsed.originalCorrect,
      editedCorrect: !!parsed.editedCorrect,
      originalReason: typeof parsed.originalReason === 'string' ? parsed.originalReason : null,
      editedReason: typeof parsed.editedReason === 'string' ? parsed.editedReason : null,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '',
    }
  } catch {
    return null
  }
}

async function checkSlideRegionWithGemini(genAI: GoogleGenerativeAI, prompt: string): Promise<RegionCompareLite | null> {
  try {
    const model = genAI.getGenerativeModel(GEMINI_25_PRO as { model: 'gemini-2.5-pro' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    return parseRegionCompareLite(text)
  } catch {
    return null
  }
}

async function checkSlideRegionWithDeepSeek(prompt: string): Promise<RegionCompareLite | null> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) return null
    const model = process.env.DEEPSEEK_VERIFY_MODEL?.trim() || 'deepseek-reasoner'
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: 'Trả về đúng JSON theo yêu cầu, không markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    return parseRegionCompareLite(text)
  } catch {
    return null
  }
}

async function verifySlideProposalByAI(params: {
  originalRegion: string
  editedRegion: string
  slideTitle?: string
  blockHeader?: string
}): Promise<{ ok: boolean; reason: string }> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return { ok: false, reason: 'Thiếu GOOGLE_API_KEY.' }

  const original = params.originalRegion.slice(0, 1400)
  const edited = params.editedRegion.slice(0, 1400)
  const contextLine = `Ngữ cảnh slide: title="${params.slideTitle ?? ''}", block="${params.blockHeader ?? ''}".`
  const prompt = `${contextLine}\n${SLIDE_REGION_PROMPT.replace('{originalRegion}', original).replace('{editedRegion}', edited)}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const [r1, r2] = await Promise.all([
    checkSlideRegionWithGemini(genAI, prompt),
    checkSlideRegionWithDeepSeek(prompt),
  ])

  const regionResult = r1 ?? r2
  if (!regionResult) return { ok: false, reason: 'AI không trả về kết quả kiểm tra.' }
  const bothAgree = !r1 || !r2 || r1.correctVersion === r2.correctVersion
  const canSave = bothAgree && regionResult.originalCorrect && regionResult.editedCorrect && regionResult.correctVersion === 'edited'
  if (canSave) return { ok: true, reason: regionResult.explanation || '2 AI đồng ý bản sửa phù hợp.' }
  return {
    ok: false,
    reason:
      regionResult.explanation ||
      regionResult.editedReason ||
      (bothAgree ? 'AI chưa đồng ý bản sửa/bổ sung.' : '2 AI chưa đồng thuận về bản sửa/bổ sung.'),
  }
}

/** Đồng bộ quiz từ sourceSlides sang các bản còn lại (shared, original, personal) */
async function syncQuizAcrossVersions(
  curriculumId: string,
  sourceSlides: SlideItem[],
  opts: {
    supabase: SupabaseClientAny
    adminClient?: ReturnType<typeof createSupabaseClient>
    userId: string | null
    topic?: string
    subjectId?: string
    gradeLevelId?: string
  }
) {
  const { supabase, adminClient, userId } = opts
  const admin: SupabaseClientAny = adminClient ?? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const applyQuizToSlides = (targetSlides: SlideItem[] | null): SlideItem[] | null => {
    if (!targetSlides || targetSlides.length === 0) return targetSlides
    return targetSlides.map((s, i) => {
      const sourceSlide = sourceSlides[i]
      if (!sourceSlide) return s
      const markers = extractQuizMarkersFromSlide(sourceSlide)
      if (markers.length === 0) return s
      return applyQuizMarkersToSlide(s, markers)
    })
  }

  const [sharedRes, originalRes, personalRes] = await Promise.all([
    supabase.from('worksheet_slides').select('content_json, topic, subject_id, grade_level_id').eq('curriculum_id', curriculumId).single(),
    admin.from('worksheet_slides_original').select('content_json').eq('curriculum_id', curriculumId).single(),
    userId ? supabase.from('user_customized_slides').select('slides_json').eq('user_id', userId).eq('curriculum_id', curriculumId).single() : { data: null },
  ])

  const sharedSlides = sharedRes.data?.content_json as SlideItem[] | null
  const originalSlides = originalRes.data?.content_json as SlideItem[] | null
  const personalSlides = personalRes.data?.slides_json as SlideItem[] | null

  const promises: Promise<unknown>[] = []

  const newShared = applyQuizToSlides(Array.isArray(sharedSlides) ? sharedSlides : null)
  if (newShared && newShared.length > 0) {
    promises.push(
      supabase
        .from('worksheet_slides')
        .update({
          content_json: newShared,
          topic: opts.topic ?? (sharedRes.data as { topic?: string })?.topic,
          subject_id: opts.subjectId ?? (sharedRes.data as { subject_id?: string })?.subject_id ?? 'toan',
          grade_level_id: opts.gradeLevelId ?? (sharedRes.data as { grade_level_id?: string })?.grade_level_id ?? 'lop-6',
        })
        .eq('curriculum_id', curriculumId) as Promise<unknown>
    )
  }

  const newOriginal = applyQuizToSlides(Array.isArray(originalSlides) ? originalSlides : null)
  if (newOriginal && newOriginal.length > 0) {
    promises.push(admin.from('worksheet_slides_original').update({ content_json: newOriginal }).eq('curriculum_id', curriculumId) as Promise<unknown>)
  }

  const newPersonal = applyQuizToSlides(Array.isArray(personalSlides) ? personalSlides : null)
  if (newPersonal && newPersonal.length > 0 && userId) {
    promises.push(
      supabase
        .from('user_customized_slides')
        .update({ slides_json: newPersonal, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('curriculum_id', curriculumId) as Promise<unknown>
    )
  }

  await Promise.all(promises)
}

/** Lưu slide bài giảng AI vào DB (gắn với giáo trình) – bản chung, mọi giáo viên dùng */
export async function saveSlidesToCurriculum(opts: {
  curriculumId: string
  topic: string
  subjectId: string
  gradeLevelId: string
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; visualInput1?: string; visualInput2?: string; visualInput3?: string; visualInput4?: string; teacherNotes?: string }>
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu slide.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { error } = await supabase
    .from('worksheet_slides')
    .upsert(
      {
        curriculum_id: opts.curriculumId,
        user_id: user?.id ?? null,
        topic: opts.topic || null,
        subject_id: opts.subjectId || 'toan',
        grade_level_id: opts.gradeLevelId || 'lop-6',
        content_json: opts.slides,
      },
      { onConflict: 'curriculum_id' }
    )

  if (error) return { error: error.message }

  await supabase.from('worksheet_slide_edit_history').insert({
    curriculum_id: opts.curriculumId,
    user_id: user?.id ?? null,
    slides_json: opts.slides,
  })

  try {
    await syncQuizAcrossVersions(opts.curriculumId, opts.slides, {
      supabase,
      userId: user?.id ?? null,
      topic: opts.topic,
      subjectId: opts.subjectId,
      gradeLevelId: opts.gradeLevelId,
    })
  } catch (e) {
    console.warn('[saveSlidesToCurriculum] Quiz sync failed:', e)
  }

  return { success: true }
}

/** Lấy slide bản chung theo giáo trình */
export async function getSlidesByCurriculumId(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_slides')
    .select('content_json')
    .eq('curriculum_id', curriculumId)
    .single()

  if (error || !data) return { success: true, slides: null }
  const slides = data.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  return { success: true, slides: Array.isArray(slides) ? slides : null }
}

/** Lấy bản gốc slide (AI tạo lần đầu, không bị ghi đè) */
export async function getOriginalSlides(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_slides_original')
    .select('content_json')
    .eq('curriculum_id', curriculumId)
    .single()

  if (error || !data) return { success: true, slides: null }
  const slides = data.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  return { success: true, slides: Array.isArray(slides) ? slides : null }
}

/** Lưu bản gốc lần đầu (khi AI tạo) – chỉ gọi khi chưa có bản gốc */
export async function saveOriginalSlidesIfNotExists(opts: {
  curriculumId: string
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; visualInput1?: string; visualInput2?: string; visualInput3?: string; visualInput4?: string; teacherNotes?: string }>
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: existing } = await supabase
    .from('worksheet_slides_original')
    .select('id')
    .eq('curriculum_id', opts.curriculumId)
    .single()

  if (existing) return { success: true, saved: false }

  const { error } = await supabase.from('worksheet_slides_original').insert({
    curriculum_id: opts.curriculumId,
    content_json: opts.slides,
  })

  if (error) return { error: error.message }
  return { success: true, saved: true }
}

const SHARED_HISTORY_DAYS = 7

/** Lịch sử chỉnh sửa bản chung – chỉ lấy trong 7 ngày, xóa bản cũ hơn */
export async function getSlideEditHistory(curriculumId: string, limit = 20) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SHARED_HISTORY_DAYS)

  const { data, error } = await supabase
    .from('worksheet_slide_edit_history')
    .select('id, user_id, slides_json, created_at')
    .eq('curriculum_id', curriculumId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { error: error.message }

  void cleanSharedHistoryOlderThan(supabase, cutoff)

  return { success: true, items: data ?? [] }
}

async function cleanSharedHistoryOlderThan(supabase: ReturnType<typeof createClient>, cutoff: Date) {
  await supabase
    .from('worksheet_slide_edit_history')
    .delete()
    .lt('created_at', cutoff.toISOString())
}

/** Khôi phục bản chung từ lịch sử — đã tắt (chỉ giữ khôi phục bản riêng). */
export async function restoreSharedFromHistory(curriculumId: string, historyId: string) {
  void curriculumId
  void historyId
  return {
    error:
      'Đã tắt khôi phục bản chung. Dùng bản riêng (Lưu bản riêng) và mục Lịch sử để khôi phục phiên bản cá nhân.',
  }
}

/** Lấy slide đã chỉnh sửa của giáo viên (thêm biểu đồ, sửa nội dung) – không đổi dữ liệu gốc */
export async function getUserCustomizedSlides(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { data, error } = await supabase
    .from('user_customized_slides')
    .select('slides_json')
    .eq('user_id', user.id)
    .eq('curriculum_id', curriculumId)
    .single()

  if (error || !data) return { success: true, slides: null }
  const slides = data.slides_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  return { success: true, slides: Array.isArray(slides) ? slides : null }
}

/** Lưu slide đã chỉnh sửa của giáo viên – chỉ ghi vào user_customized_slides, không đổi worksheet_slides */
export async function saveUserCustomizedSlides(opts: {
  curriculumId: string
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; visualInput1?: string; visualInput2?: string; visualInput3?: string; visualInput4?: string; teacherNotes?: string }>
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu chỉnh sửa.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { error } = await supabase
    .from('user_customized_slides')
    .upsert(
      {
        user_id: user.id,
        curriculum_id: opts.curriculumId,
        slides_json: opts.slides,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,curriculum_id' }
    )

  if (error) return { error: error.message }

  await supabase.from('user_customized_slides_history').insert({
    user_id: user.id,
    curriculum_id: opts.curriculumId,
    slides_json: opts.slides,
  })

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERSONAL_HISTORY_DAYS)
  await supabase
    .from('user_customized_slides_history')
    .delete()
    .eq('user_id', user.id)
    .eq('curriculum_id', opts.curriculumId)
    .lt('created_at', cutoff.toISOString())

  try {
    await syncQuizAcrossVersions(opts.curriculumId, opts.slides, {
      supabase,
      userId: user.id,
    })
  } catch (e) {
    console.warn('[saveUserCustomizedSlides] Quiz sync failed:', e)
  }

  return { success: true }
}

const PERSONAL_HISTORY_DAYS = 7

/** Lấy lịch sử bản riêng – các bản đã lưu (trong 7 ngày, sau đó xóa) */
export async function getPersonalSlidesHistory(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERSONAL_HISTORY_DAYS)

  const { data, error } = await supabase
    .from('user_customized_slides_history')
    .select('id, slides_json, created_at')
    .eq('user_id', user.id)
    .eq('curriculum_id', curriculumId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
}

/** Reset bản riêng về bản gốc – lưu bản hiện tại vào lịch sử trước */
export async function resetPersonalToOriginal(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { data: current } = await supabase
    .from('user_customized_slides')
    .select('slides_json')
    .eq('user_id', user.id)
    .eq('curriculum_id', curriculumId)
    .single()

  const originalRes = await getOriginalSlides(curriculumId)
  if (originalRes?.error || !originalRes?.slides) return { error: 'Không có bản gốc.' }

  if (current?.slides_json && Array.isArray(current.slides_json) && current.slides_json.length > 0) {
    await supabase.from('user_customized_slides_history').insert({
      user_id: user.id,
      curriculum_id: curriculumId,
      slides_json: current.slides_json,
    })
  }

  const { error } = await supabase
    .from('user_customized_slides')
    .upsert(
      {
        user_id: user.id,
        curriculum_id: curriculumId,
        slides_json: originalRes.slides,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,curriculum_id' }
    )

  if (error) return { error: error.message }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERSONAL_HISTORY_DAYS)
  await supabase
    .from('user_customized_slides_history')
    .delete()
    .eq('user_id', user.id)
    .eq('curriculum_id', curriculumId)
    .lt('created_at', cutoff.toISOString())

  return { success: true }
}

/** Khôi phục bản riêng từ lịch sử */
export async function restorePersonalFromHistory(curriculumId: string, historyId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { data, error } = await supabase
    .from('user_customized_slides_history')
    .select('slides_json, created_at')
    .eq('id', historyId)
    .eq('user_id', user.id)
    .eq('curriculum_id', curriculumId)
    .single()

  if (error || !data) return { error: 'Không tìm thấy bản lưu.' }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERSONAL_HISTORY_DAYS)
  if (new Date(data.created_at) < cutoff) return { error: 'Bản lưu đã hết hạn khôi phục (7 ngày).' }

  const { error: upsertErr } = await supabase
    .from('user_customized_slides')
    .upsert(
      {
        user_id: user.id,
        curriculum_id: curriculumId,
        slides_json: data.slides_json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,curriculum_id' }
    )

  if (upsertErr) return { error: upsertErr.message }
  return { success: true }
}

/** Đề xuất sửa/bổ sung slide – đánh dấu đoạn, gõ nội dung đề xuất */
export async function createSlideEditProposal(opts: {
  curriculumId: string
  slideIndex: number
  blockIndex: number
  segmentType: 'edit' | 'add'
  originalText?: string
  proposedText: string
  proposedHeader?: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để đề xuất sửa.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const verify = await verifySlideEditProposalDraft(opts)
  if (verify && 'error' in verify) return { error: verify.error }
  if (!verify?.ok) return { error: `AI chưa đồng ý đề xuất: ${verify?.reason || 'Không có lý do.'}` }

  const { data, error } = await supabase
    .from('slide_edit_proposals')
    .insert({
      curriculum_id: opts.curriculumId,
      slide_index: opts.slideIndex,
      block_index: opts.blockIndex,
      segment_type: opts.segmentType,
      original_text: opts.originalText ?? null,
      proposed_text: opts.proposedText,
      proposed_header: opts.segmentType === 'add' ? (opts.proposedHeader ?? 'Nội dung bổ sung') : null,
      proposed_by: user?.id ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { success: true, proposalId: data?.id }
}

/** Kiểm tra draft đề xuất sửa/bổ sung slide bằng AI trước khi cho gửi proposal. */
export async function verifySlideEditProposalDraft(opts: {
  curriculumId: string
  slideIndex: number
  blockIndex: number
  segmentType: 'edit' | 'add'
  originalText?: string
  proposedText: string
  proposedHeader?: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để kiểm tra đề xuất sửa.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: slidesData, error: slidesErr } = await supabase
    .from('worksheet_slides')
    .select('content_json')
    .eq('curriculum_id', opts.curriculumId)
    .single()
  if (slidesErr) return { error: slidesErr.message }
  const slides = (slidesData?.content_json ?? null) as Array<{ title?: string; blocks?: Array<{ header?: string; content?: string }> }> | null
  if (!Array.isArray(slides)) return { error: 'Không tìm thấy nội dung slide để kiểm tra AI.' }
  const slide = slides[opts.slideIndex]
  if (!slide) return { error: 'Slide không tồn tại.' }
  const blocks = Array.isArray(slide.blocks) ? slide.blocks : []
  const block = blocks[opts.blockIndex]
  const blockContent = String(block?.content ?? '')
  const blockHeader = String(block?.header ?? '')

  if (opts.segmentType === 'edit') {
    const orig = String(opts.originalText ?? '').trim()
    if (!orig || !blockContent.includes(orig)) {
      return { error: 'Đoạn cần sửa không tồn tại trong block hiện tại.' }
    }
    const replacement = String(opts.proposedText ?? '').trim()
    const edited = blockContent.replace(orig, replacement)
    const aiCheck = await verifySlideProposalByAI({
      originalRegion: blockContent,
      editedRegion: edited,
      slideTitle: String(slide.title ?? ''),
      blockHeader,
    })
    return aiCheck.ok
      ? { ok: true, reason: aiCheck.reason }
      : { ok: false, reason: `Đề xuất sửa chưa đạt: ${aiCheck.reason}` }
  } else {
    const addHeader = String(opts.proposedHeader ?? 'Nội dung bổ sung').trim()
    const addText = String(opts.proposedText ?? '').trim()
    if (!addText) return { error: 'Vui lòng nhập nội dung đề xuất.' }
    const originalRegion = blockContent || '(block trống)'
    const editedRegion = `${originalRegion}\n\n[BLOCK BỔ SUNG]\n${addHeader}\n${addText}`
    const aiCheck = await verifySlideProposalByAI({
      originalRegion,
      editedRegion,
      slideTitle: String(slide.title ?? ''),
      blockHeader: addHeader,
    })
    return aiCheck.ok
      ? { ok: true, reason: aiCheck.reason }
      : { ok: false, reason: `Đề xuất bổ sung chưa đạt: ${aiCheck.reason}` }
  }
}

/** AI đồng ý thì áp dụng sửa/bổ sung ngay vào slide dùng chung. */
export async function applySlideEditDirect(opts: {
  curriculumId: string
  slideIndex: number
  blockIndex: number
  segmentType: 'edit' | 'add'
  originalText?: string
  proposedText: string
  proposedHeader?: string
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để áp dụng sửa slide.')
  if ('error' in authResult) return { error: authResult.error }
  const userId = authResult.user?.id ?? null

  const verify = await verifySlideEditProposalDraft(opts)
  if (verify && 'error' in verify) return { error: verify.error }
  if (!verify?.ok) return { error: verify?.reason || 'AI chưa đồng ý đề xuất.' }

  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: slidesData, error: slidesErr } = await admin
    .from('worksheet_slides')
    .select('content_json, topic, subject_id, grade_level_id')
    .eq('curriculum_id', opts.curriculumId)
    .single()
  if (slidesErr) return { error: slidesErr.message }
  const slidesRow = slidesData as SlidesRow | null
  if (!slidesRow) return { error: 'Không tìm thấy slide dùng chung.' }

  const slides = slidesRow.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  if (!Array.isArray(slides)) return { error: 'Dữ liệu slide không hợp lệ.' }
  const slide = slides[opts.slideIndex]
  if (!slide) return { error: 'Slide không tồn tại.' }
  const blocks = [...(slide.blocks ?? [])]

  if (opts.segmentType === 'edit') {
    const block = blocks[opts.blockIndex]
    const orig = String(opts.originalText ?? '').trim()
    if (!block || !orig || !block.content.includes(orig)) return { error: 'Không tìm thấy đoạn cần sửa trong block hiện tại.' }
    blocks[opts.blockIndex] = { ...block, content: block.content.replace(orig, String(opts.proposedText ?? '').trim()) }
  } else {
    const addHeader = String(opts.proposedHeader ?? 'Nội dung bổ sung').trim() || 'Nội dung bổ sung'
    const addText = String(opts.proposedText ?? '').trim()
    if (!addText) return { error: 'Nội dung bổ sung không được để trống.' }
    blocks.splice(Math.min(opts.blockIndex + 1, blocks.length), 0, { header: addHeader, content: addText })
  }

  const newSlides = slides.map((s, i) => (i === opts.slideIndex ? { ...s, blocks } : s))

  const { error: updErr } = await admin
    .from('worksheet_slides')
    .update({
      content_json: newSlides,
      topic: slidesRow.topic ?? undefined,
      subject_id: slidesRow.subject_id ?? undefined,
      grade_level_id: slidesRow.grade_level_id ?? undefined,
    })
    .eq('curriculum_id', opts.curriculumId)
  if (updErr) return { error: updErr.message }

  await admin.from('worksheet_slide_edit_history').insert({
    curriculum_id: opts.curriculumId,
    user_id: userId,
    slides_json: newSlides,
  })

  try {
    await syncQuizAcrossVersions(opts.curriculumId, newSlides, {
      supabase: admin,
      userId,
      topic: slidesRow.topic ?? undefined,
      subjectId: slidesRow.subject_id ?? undefined,
      gradeLevelId: slidesRow.grade_level_id ?? undefined,
    })
  } catch (e) {
    console.warn('[applySlideEditDirect] Quiz sync failed:', e)
  }

  return { success: true, slides: newSlides }
}

/** Xóa đề xuất – chỉ người tạo, khi chưa có ai bình chọn */
export async function deleteSlideProposal(proposalId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { data: p, error: fetchErr } = await supabase
    .from('slide_edit_proposals')
    .select('id, proposed_by, agree_count, disagree_count, status')
    .eq('id', proposalId)
    .single()

  if (fetchErr || !p) return { error: 'Không tìm thấy đề xuất.' }
  if (p.status !== 'pending') return { error: 'Chỉ xóa được đề xuất đang chờ.' }
  if (p.proposed_by !== user?.id) return { error: 'Chỉ người tạo mới xóa được.' }
  const totalVotes = (p.agree_count ?? 0) + (p.disagree_count ?? 0)
  if (totalVotes > 0) return { error: 'Đã có người bình chọn, không thể xóa.' }

  const { error: delErr } = await supabase.from('slide_edit_proposals').delete().eq('id', proposalId)
  if (delErr) return { error: delErr.message }
  return { success: true }
}

/** Bỏ phiếu đồng ý/không đồng ý cho đề xuất */
export async function voteOnSlideProposal(proposalId: string, vote: 'agree' | 'disagree') {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để bỏ phiếu.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const { error } = await supabase
    .from('slide_edit_votes')
    .upsert(
      { proposal_id: proposalId, user_id: user!.id, vote },
      { onConflict: 'proposal_id,user_id' }
    )

  if (error) return { error: error.message }

  const adminClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const applied = await applySlideProposalIfEligible(adminClient, proposalId)
  if (applied) return { success: true, applied: true }

  const { data: p } = await adminClient
    .from('slide_edit_proposals')
    .select('id, disagree_count, status')
    .eq('id', proposalId)
    .single()

  if (p && p.status === 'pending' && (p.disagree_count ?? 0) >= 5) {
    await adminClient.from('slide_edit_proposals').delete().eq('id', proposalId)
    return { success: true, applied: false, deleted: true }
  }

  return { success: true, applied: false }
}

type ProposalRow = { id: string; curriculum_id: string; slide_index: number; block_index: number; segment_type: string; original_text: string | null; proposed_text: string | null; proposed_header: string | null; agree_count: number | null; status: string }
type SlidesRow = { content_json: unknown; topic: string | null; subject_id: string | null; grade_level_id: string | null }

/** Áp dụng đề xuất khi có >= 5 người đồng ý – dùng service role để bypass RLS (voter không phải proposer) */
async function applySlideProposalIfEligible(supabase: SupabaseClientAny, proposalId: string) {
  const { data: pData } = await supabase
    .from('slide_edit_proposals')
    .select('id, curriculum_id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, agree_count, status')
    .eq('id', proposalId)
    .single()

  const p = pData as ProposalRow | null
  if (!p || p.status !== 'pending' || (p.agree_count ?? 0) < 5) return null

  const { data: slidesData } = await supabase
    .from('worksheet_slides')
    .select('content_json, topic, subject_id, grade_level_id')
    .eq('curriculum_id', p.curriculum_id)
    .single()

  const slidesRow = slidesData as SlidesRow | null
  if (!slidesRow) return null

  const slides = slidesRow.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  if (!Array.isArray(slides)) return null

  const slide = slides[p.slide_index]
  if (!slide) return null

  const blocks = [...(slide.blocks ?? [])]
  if (p.segment_type === 'edit') {
    const block = blocks[p.block_index]
    if (!block || !p.original_text || !block.content.includes(p.original_text)) return null
    const newContent = block.content.replace(p.original_text, p.proposed_text ?? '')
    blocks[p.block_index] = { ...block, content: newContent }
  } else {
    const newBlock = { header: p.proposed_header ?? 'Nội dung bổ sung', content: p.proposed_text ?? '' }
    blocks.splice(Math.min(p.block_index + 1, blocks.length), 0, newBlock)
  }

  const newSlides = slides.map((s, i) =>
    i === p.slide_index ? { ...s, blocks } : s
  )

  await supabase
    .from('worksheet_slides')
    .update({
      content_json: newSlides,
      topic: slidesRow.topic ?? undefined,
      subject_id: slidesRow.subject_id ?? undefined,
      grade_level_id: slidesRow.grade_level_id ?? undefined,
    })
    .eq('curriculum_id', p.curriculum_id)

  await supabase.from('worksheet_slide_edit_history').insert({
    curriculum_id: p.curriculum_id,
    user_id: null,
    slides_json: newSlides,
  })

  await supabase
    .from('slide_edit_proposals')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', proposalId)

  try {
    await syncQuizAcrossVersions(p.curriculum_id, newSlides, {
      supabase,
      userId: null,
      topic: slidesRow.topic ?? undefined,
      subjectId: slidesRow.subject_id ?? undefined,
      gradeLevelId: slidesRow.grade_level_id ?? undefined,
    })
  } catch (e) {
    console.warn('[applySlideProposalIfEligible] Quiz sync failed:', e)
  }

  return true
}

/** Lấy đề xuất sửa slide theo curriculum (để hiển thị trong viewer) */
export async function getSlideProposalsForCurriculum(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? ''

  const { data, error } = await supabase
    .from('slide_edit_proposals')
    .select('id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, status, agree_count, disagree_count, proposed_by, created_at')
    .eq('curriculum_id', curriculumId)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  const { data: myVotes } = await supabase
    .from('slide_edit_votes')
    .select('proposal_id, vote')
    .eq('user_id', userId)

  const voteMap = new Map((myVotes ?? []).map((v) => [v.proposal_id, v.vote]))

  const items = (data ?? []).map((r) => ({
    ...r,
    myVote: voteMap.get(r.id),
  }))

  return { success: true, items, currentUserId: userId || null }
}

/** Admin: danh sách tất cả đề xuất sửa slide */
export async function listSlideProposalsForAdmin(opts?: { status?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Vui lòng đăng nhập.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Bạn cần quyền admin.' }

  let q = supabase
    .from('slide_edit_proposals')
    .select('id, curriculum_id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, status, agree_count, disagree_count, proposed_by, created_at')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100)

  if (opts?.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
}

/** Admin: duyệt hoặc từ chối đề xuất (admin có thể duyệt bất kể số phiếu) */
export async function adminReviewSlideProposal(proposalId: string, action: 'approve' | 'reject') {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Vui lòng đăng nhập.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Bạn cần quyền admin.' }

  if (action === 'approve') {
    const adminClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const applied = await applySlideProposalIfEligible(adminClient, proposalId)
    if (!applied) {
      const appliedForce = await applySlideProposalForce(adminClient, proposalId)
      if (!appliedForce) {
        return { error: 'Không thể áp dụng đề xuất (slide có thể đã bị xóa hoặc cấu trúc không khớp).' }
      }
    }
  } else {
    const { error } = await supabase.from('slide_edit_proposals').update({ status: 'rejected' }).eq('id', proposalId)
    if (error) return { error: error.message }
  }

  return { success: true }
}

/** Áp dụng đề xuất (bỏ qua kiểm tra 5 phiếu – dùng khi admin duyệt) */
async function applySlideProposalForce(supabase: SupabaseClientAny, proposalId: string) {
  const { data: pData } = await supabase
    .from('slide_edit_proposals')
    .select('id, curriculum_id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, status')
    .eq('id', proposalId)
    .single()

  const p = pData as (ProposalRow & { agree_count?: number }) | null
  if (!p || p.status !== 'pending') return null

  const { data: slidesData } = await supabase
    .from('worksheet_slides')
    .select('content_json, topic, subject_id, grade_level_id')
    .eq('curriculum_id', p.curriculum_id)
    .single()

  const slidesRow = slidesData as SlidesRow | null

  if (!slidesRow) return null

  const slides = slidesRow.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  if (!Array.isArray(slides)) return null

  const slide = slides[p.slide_index]
  if (!slide) return null

  const blocks = [...(slide.blocks ?? [])]
  if (p.segment_type === 'edit') {
    const block = blocks[p.block_index]
    if (!block || !p.original_text || !block.content.includes(p.original_text)) return null
    const newContent = block.content.replace(p.original_text, p.proposed_text ?? '')
    blocks[p.block_index] = { ...block, content: newContent }
  } else {
    const newBlock = { header: p.proposed_header ?? 'Nội dung bổ sung', content: p.proposed_text ?? '' }
    blocks.splice(Math.min(p.block_index + 1, blocks.length), 0, newBlock)
  }

  const newSlides = slides.map((s, i) =>
    i === p.slide_index ? { ...s, blocks } : s
  )

  await supabase
    .from('worksheet_slides')
    .update({
      content_json: newSlides,
      topic: slidesRow.topic ?? undefined,
      subject_id: slidesRow.subject_id ?? undefined,
      grade_level_id: slidesRow.grade_level_id ?? undefined,
    })
    .eq('curriculum_id', p.curriculum_id)

  await supabase.from('worksheet_slide_edit_history').insert({
    curriculum_id: p.curriculum_id,
    user_id: null,
    slides_json: newSlides,
  })

  await supabase
    .from('slide_edit_proposals')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', proposalId)

  try {
    await syncQuizAcrossVersions(p.curriculum_id, newSlides, {
      supabase,
      userId: null,
      topic: slidesRow.topic ?? undefined,
      subjectId: slidesRow.subject_id ?? undefined,
      gradeLevelId: slidesRow.grade_level_id ?? undefined,
    })
  } catch (e) {
    console.warn('[applySlideProposalForce] Quiz sync failed:', e)
  }

  return true
}

/** Admin: danh sách giáo trình giáo viên gửi khi 2 AI báo sai */
export async function listCurriculumEditReviewsForAdmin(opts?: { status?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Vui lòng đăng nhập.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Bạn cần quyền admin.' }

  let q = supabase
    .from('curriculum_edit_reviews')
    .select('id, user_id, curriculum_id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume, lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, goals, content_markdown, ai_errors, status, created_at, admin_note')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 50)

  if (opts?.status) q = q.eq('status', opts.status)

  const { data, error } = await q
  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
}

/** Admin: duyệt hoặc từ chối giáo trình gửi lên */
export async function adminReviewCurriculumEdit(reviewId: string, action: 'approve' | 'reject', adminNote?: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Vui lòng đăng nhập.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Bạn cần quyền admin.' }

  const { data: row } = await supabase
    .from('curriculum_edit_reviews')
    .select('*')
    .eq('id', reviewId)
    .single()

  if (!row) return { error: 'Không tìm thấy.' }
  const status = (row as { status?: string }).status
  if (status !== 'pending') return { error: 'Đã xử lý rồi.' }

  const r = row as {
    curriculum_id?: string | null
    user_id?: string | null
    topic: string
    subject_id: string
    grade_level_id: string
    textbook_set_id: string
    textbook_volume?: string | null
    lesson_number?: number | null
    lesson_type_id: string
    num_lessons: number
    lesson_duration_minutes: number
    goals?: string | null
    content_markdown: string
  }

  if (action === 'approve') {
    const adminClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const vol = r.textbook_volume === '1' || r.textbook_volume === '2' ? r.textbook_volume : null
    if (r.curriculum_id) {
      const { error: updErr } = await adminClient
        .from('worksheet_curricula')
        .update({
          content_markdown: r.content_markdown,
          topic: r.topic,
        })
        .eq('id', r.curriculum_id)
      if (updErr) return { error: updErr.message }
    } else {
      const { error: insErr } = await adminClient
        .from('worksheet_curricula')
        .insert({
          user_id: r.user_id ?? null,
          topic: r.topic,
          subject_id: r.subject_id,
          grade_level_id: r.grade_level_id,
          textbook_set_id: r.textbook_set_id,
          textbook_volume: vol,
          lesson_number: r.lesson_number,
          lesson_type_id: r.lesson_type_id,
          num_lessons: r.num_lessons,
          lesson_duration_minutes: r.lesson_duration_minutes,
          goals: r.goals || null,
          content_markdown: r.content_markdown,
        })
      if (insErr) return { error: insErr.message }
    }
  }

  const dbStatus = action === 'approve' ? 'approved' : 'rejected'
  const { error: updErr } = await supabase
    .from('curriculum_edit_reviews')
    .update({
      status: dbStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      admin_note: adminNote || null,
    })
    .eq('id', reviewId)

  if (updErr) return { error: updErr.message }
  return { success: true }
}
