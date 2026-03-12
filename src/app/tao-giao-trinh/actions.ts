'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { normalizeTopicForSearch, topicsMatch } from './lib/topic-normalize'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_25_PRO } from '@/lib/gemini-config'

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
  if (!data || data.length < 3) return null
  const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, limit)
  return shuffled
}

/** Format câu hỏi có sẵn thành Markdown cho phiếu bài tập. */
function formatOfficialQuestionsAsMarkdown(questions: Array<{ question_text: string; options: string[]; correct_index: number }>) {
  const lines: string[] = ['### 1. Mức 1 – Nhận biết (Trắc nghiệm)', '']
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
  lines.push('**Đáp án trắc nghiệm:** ' + answers.join(', '))
  return lines.join('\n')
}

/** AI trích ≥5 topic từ nội dung giáo trình – dùng để khớp câu hỏi. */
async function extractLessonTopicsFromContent(
  content: string,
  genAI: GoogleGenerativeAI
): Promise<string[]> {
  try {
    const prompt = `Trích từ giáo trình dưới đây ít nhất 5 chủ đề/kiến thức chính (mỗi topic 1-5 từ, tiếng Việt, cụ thể không chung chung).
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
    return [...new Set(normalized)].slice(0, 10)
  } catch {
    return []
  }
}

/** Tạo giáo trình bằng AI cho mọi môn học. */
export async function createCurriculum(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  const textbookSetId = (formData.get('textbookSetId') as string)?.trim() || 'ket-noi-tri-thuc'
  const textbookVolume = (formData.get('textbookVolume') as string)?.trim() || ''
  const lessonNumberRaw = (formData.get('lessonNumber') as string)?.trim() || ''
  const lessonNumber = lessonNumberRaw ? parseInt(lessonNumberRaw, 10) : null
  const lessonTypeId = (formData.get('lessonTypeId') as string)?.trim() || 'hinh-thanh-kien-thuc'
  const topic = (formData.get('topic') as string)?.trim() || ''
  const numLessons = parseInt(String(formData.get('numLessons') || '3'), 10) || 3
  const lessonDurationMinutes = parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10) || 45
  const goals = (formData.get('goals') as string)?.trim() || ''

  const lessonNum = lessonNumber != null && lessonNumber >= 1 && lessonNumber <= 999 ? lessonNumber : null
  if (!lessonNum) {
    return { error: 'Vui lòng nhập bài số (1–999).' }
  }

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac
  const lessonTypeName = LESSON_TYPE_NAMES[lessonTypeId] || LESSON_TYPE_NAMES['hinh-thanh-kien-thuc']

  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo giáo trình.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const vol = textbookVolume === '1' || textbookVolume === '2' ? textbookVolume : null
  const numTiet = Math.min(10, Math.max(1, numLessons))
  const thoiLuong = Math.min(120, Math.max(15, lessonDurationMinutes))

  const loadLessonTitleFromDb = async () => {
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

  // Kiểm tra DB: khớp môn + lớp + bộ sách + tập + loại bài + bài số + số tiết + thời gian mỗi tiết
  const { data: existing } = await supabase
    .from('worksheet_curricula')
    .select('id, content_markdown, textbook_volume, lesson_number')
    .eq('subject_id', subjectId)
    .eq('grade_level_id', gradeLevelId)
    .eq('textbook_set_id', textbookSetId)
    .eq('lesson_type_id', lessonTypeId)
    .eq('num_lessons', numTiet)
    .eq('lesson_duration_minutes', thoiLuong)
    .limit(100)

  const match = existing?.find((r) => {
    const rVol = (r as { textbook_volume?: string | null }).textbook_volume
    const rNum = (r as { lesson_number?: number | null }).lesson_number
    const volMatch = (vol ?? '') === (rVol ?? '')
    const numMatch = lessonNum === (rNum ?? 0)
    return volMatch && numMatch
  })
  if (match) {
    return { success: true, curriculumMarkdown: match.content_markdown ?? '', curriculumId: match.id, matched: true }
  }

  // Tra cứu tên bài từ mục lục SGK trong DB (không dùng AI tạo mục lục).
  const lessonTitle: string | null = await loadLessonTitleFromDb()

  const curriculumMenDeNote = ''

  const prompt = `Hãy soạn giáo trình cho Bài ${lessonNum}, môn ${subjectName}, ${gradeLabel}, bộ sách ${textbookName}.

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

    const { data: row, error: insertErr } = await supabase
      .from('worksheet_curricula')
      .insert({
        user_id: user?.id ?? null,
        topic: lessonTitle ?? `Bài ${lessonNum}`,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        textbook_set_id: textbookSetId,
        textbook_volume: vol,
        lesson_number: lessonNum,
        lesson_type_id: lessonTypeId,
        num_lessons: numTiet,
        lesson_duration_minutes: thoiLuong,
        goals: goals.trim() || null,
        content_markdown: text,
        lesson_topics: lessonTopics.length >= 5 ? lessonTopics : null,
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

/** Tạo Phiếu bài tập đi kèm giáo trình – phân hóa 4 mức độ nhận thức. Lưu theo bộ giáo trình (curriculum_id). */
export async function createWorksheet(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const curriculumMarkdown = (formData.get('curriculumMarkdown') as string)?.trim() || ''
  const curriculumId = (formData.get('curriculumId') as string)?.trim() || null
  const topic = (formData.get('topic') as string)?.trim() || ''
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  if (!curriculumMarkdown) {
    return { error: 'Vui lòng tạo giáo trình trước khi tạo phiếu bài tập.' }
  }

  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo phiếu bài tập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  let lessonTopics: string[] | undefined
  if (curriculumId) {
    const { data: curriculum } = await supabase
      .from('worksheet_curricula')
      .select('lesson_topics')
      .eq('id', curriculumId)
      .single()
    lessonTopics =
      Array.isArray(curriculum?.lesson_topics) && curriculum.lesson_topics.length >= 1
        ? (curriculum.lesson_topics as string[])
        : undefined
  }

  const officialQuestions = await getOfficialQuestions(
    supabase,
    subjectId,
    gradeLevelId,
    5,
    lessonTopics
  )
  const useOfficialQuiz = officialQuestions && officialQuestions.length >= 3

  const isMenDePhuDinh = /mệnh\s*đề\s*phủ\s*định|phủ\s*định\s*mệnh\s*đề|mệnh\s*đề.*phủ\s*định/i.test(topic)
  const menDePhuDinhNote = isMenDePhuDinh
    ? `\n\n**LƯU Ý – Mệnh đề phủ định:** Phân biệt rõ nội dung phát biểu và giá trị chân lý (Đúng/Sai). Tránh dùng khái niệm đối lập không hoàn toàn như "số nguyên tố" và "hợp số" làm phủ định của nhau.`
    : ''

  const systemPrompt = `Bạn là chuyên gia soạn phiếu bài tập cho học sinh Việt Nam. Trả về đúng nội dung Markdown theo yêu cầu, không thêm giải thích. BẮT BUỘC dùng Unicode cho công thức – KHÔNG dùng LaTeX $...$ vì học sinh cần đọc trực tiếp: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2 hoặc ½. Căn: √(x+1).`

  const structureSection = useOfficialQuiz
    ? `**Cấu trúc bắt buộc – Phần trắc nghiệm đã có sẵn từ ngân hàng câu hỏi Bộ GD, CHỈ cần soạn các phần sau:**

### 2. Mức 2 – Thông hiểu
- 2 bài tập tự luận: áp dụng công thức trực tiếp, mức độ đơn giản.

### 3. Mức 3 – Vận dụng thấp
- 2 bài tập tổng hợp: biến đổi hoặc kết hợp nhiều kiến thức.

### 4. Mức 4 – Vận dụng cao (Thực tế)
- 1 bài toán thực tiễn hoặc câu hỏi thử thách (điểm 9–10).

### 5. Đáp án & Lời giải chi tiết
- Chỉ lời giải chi tiết cho các bài tự luận (Mức 2, 3, 4), KHÔNG cần đáp án trắc nghiệm.`
    : `**Cấu trúc bắt buộc (phân hóa 4 mức độ nhận thức theo Thang Bloom):**

### 1. Mức 1 – Nhận biết (Trắc nghiệm)
- 5 câu trắc nghiệm: lý thuyết, định nghĩa, công thức cơ bản.
- Mỗi câu có 4 đáp án A/B/C/D, ghi rõ đáp án đúng.

### 2. Mức 2 – Thông hiểu
- 2 bài tập tự luận: áp dụng công thức trực tiếp, mức độ đơn giản.

### 3. Mức 3 – Vận dụng thấp
- 2 bài tập tổng hợp: biến đổi hoặc kết hợp nhiều kiến thức.

### 4. Mức 4 – Vận dụng cao (Thực tế)
- 1 bài toán thực tiễn hoặc câu hỏi thử thách (điểm 9–10).

### 5. Đáp án & Lời giải chi tiết
- Liệt kê đáp án trắc nghiệm (1. A, 2. B, ...).
- Lời giải chi tiết từng bước cho tất cả bài tự luận, kèm giải thích ngắn gọn.`

  const userPrompt = `Dựa trên giáo trình dưới đây, hãy soạn một PHIẾU BÀI TẬP chuyên nghiệp cho học sinh.

## GIÁO TRÌNH THAM KHẢO
${curriculumMarkdown.slice(0, 8000)}

---

## YÊU CẦU PHIẾU BÀI TẬP

**Chủ đề:** ${topic}
**Môn:** ${subjectName}
**Cấp độ:** ${gradeLabel}
${menDePhuDinhNote}

${structureSection}

**Format:** Markdown, dùng ## cho phần, ### cho mục con. Ngôn ngữ: Tiếng Việt.

**QUAN TRỌNG – Cho học sinh đọc được (BẮT BUỘC Unicode, KHÔNG LaTeX):**
- Công thức: y=x², f'(x), (0;+∞), ℝ, ∫, π, √, ∞, ↗, ↘, ⇒.
- Phân số: 1/2 hoặc ½, KHÔNG dùng $\\frac{1}{2}$ hay ((1)/(2)).
- Căn: √(1/4 - 1/2 + 1) hoặc √(x+1), dùng ngoặc tròn.
- Hàm số: y(1/2) thay vì y((1)/(2)).
- Mỗi bước tính nên xuống dòng, tránh viết quá dài.

Chỉ trả về nội dung phiếu bài tập, không có lời giải thích thêm.`

  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return { error: 'Thiếu GOOGLE_API_KEY.' }
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_PRO)
    const fullPrompt = `[Hướng dẫn hệ thống]\n${systemPrompt}\n\n[Yêu cầu]\n${userPrompt}`
    const genResult = await model.generateContent(fullPrompt)
    const text = genResult.response.text()?.trim() || ''
    if (!text) return { error: 'AI không trả về phiếu bài tập.' }

    let finalMarkdown = text
    if (useOfficialQuiz && officialQuestions) {
      const officialSection = formatOfficialQuestionsAsMarkdown(officialQuestions)
      finalMarkdown = `## Phiếu bài tập\n\n${officialSection}\n\n---\n\n${text}`
    }

    const { data: row, error: insertErr } = await supabase
      .from('worksheet_worksheets')
      .insert({
        user_id: user?.id ?? null,
        curriculum_id: curriculumId || null,
        topic: topic || 'Phiếu bài tập',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        content_markdown: finalMarkdown,
      })
      .select('id')
      .single()

    if (insertErr) {
      return { success: true, worksheetMarkdown: finalMarkdown, worksheetId: null }
    }
    return { success: true, worksheetMarkdown: finalMarkdown, worksheetId: row?.id ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Tạo phiếu bài tập thất bại: ${msg}` }
  }
}

/** Lưu giáo trình vào kho (khi tạo mới lỗi insert hoặc chưa lưu) */
export async function saveCurriculum(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ.' }
  }
  const curriculumMarkdown = (formData.get('curriculumMarkdown') as string)?.trim() || ''
  const topic = (formData.get('topic') as string)?.trim() || ''
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  const textbookSetId = (formData.get('textbookSetId') as string)?.trim() || 'ket-noi-tri-thuc'
  const textbookVolume = (formData.get('textbookVolume') as string)?.trim() || ''
  const lessonNumberRaw = (formData.get('lessonNumber') as string)?.trim() || ''
  const lessonNumber = lessonNumberRaw ? parseInt(lessonNumberRaw, 10) : null
  const lessonTypeId = (formData.get('lessonTypeId') as string)?.trim() || 'hinh-thanh-kien-thuc'
  const numLessons = parseInt(String(formData.get('numLessons') || '3'), 10) || 3
  const lessonDurationMinutes = parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10) || 45
  const goals = (formData.get('goals') as string)?.trim() || ''

  const lessonNum = lessonNumber != null && lessonNumber >= 1 && lessonNumber <= 999 ? lessonNumber : null
  if (!curriculumMarkdown || !lessonNum) {
    return { error: 'Thiếu nội dung giáo trình hoặc bài số.' }
  }

  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu giáo trình.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const numTiet = Math.min(10, Math.max(1, numLessons))
  const thoiLuong = Math.min(120, Math.max(15, lessonDurationMinutes))
  const vol = textbookVolume === '1' || textbookVolume === '2' ? textbookVolume : null

  const topicFinal = topic || `Bài ${lessonNum}`

  let lessonTopics: string[] | null = null
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (apiKey && curriculumMarkdown.length >= 100) {
    const genAI = new GoogleGenerativeAI(apiKey)
    const extracted = await extractLessonTopicsFromContent(curriculumMarkdown, genAI)
    lessonTopics = extracted.length >= 5 ? extracted : null
  }

  const { data: row, error } = await supabase
    .from('worksheet_curricula')
    .insert({
      user_id: user?.id ?? null,
      topic: topicFinal,
      subject_id: subjectId,
      grade_level_id: gradeLevelId,
      textbook_set_id: textbookSetId,
      textbook_volume: vol,
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

/** Kiểm tra DB đã có giáo trình khớp (môn + lớp + bộ sách + bài số + số tiết + thời gian) chưa */
export async function checkCurriculumExists(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonNumber: number
  numLessons: number
  lessonDurationMinutes: number
}) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const numTiet = Math.min(10, Math.max(1, opts.numLessons))
  const thoiLuong = Math.min(120, Math.max(15, opts.lessonDurationMinutes))

  const { data } = await supabase
    .from('worksheet_curricula')
    .select('id, content_markdown, topic')
    .eq('subject_id', opts.subjectId)
    .eq('grade_level_id', opts.gradeLevelId)
    .eq('textbook_set_id', opts.textbookSetId)
    .eq('lesson_type_id', 'hinh-thanh-kien-thuc')
    .eq('num_lessons', numTiet)
    .eq('lesson_duration_minutes', thoiLuong)
    .eq('lesson_number', opts.lessonNumber)
    .is('textbook_volume', null)
    .limit(1)

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
export async function fetchTextbookLessonsByAI(_opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
}) {
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
  ) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null }>[]
  if (needEnrich.length > 0) {
    const lessonOrders = [...new Set(needEnrich.map((c) => c.lesson_number!))]
    const subjectIds = [...new Set(needEnrich.map((c) => c.subject_id))]
    const gradeIds = [...new Set(needEnrich.map((c) => c.grade_level_id))]
    const textbookIds = [...new Set(needEnrich.map((c) => c.textbook_set_id).filter(Boolean) as string[])]
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

  let q = supabase
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

  const openedMap = new Map(openedRows.map((r) => [r.curriculum_id, r.opened_at]))
  const needEnrich = curricula.filter(
    (c) => (c as { lesson_number?: number | null }).lesson_number != null && !(c.topic ?? '').includes(': ')
  )
  if (needEnrich.length > 0) {
    const lessonOrders = [...new Set(needEnrich.map((c) => (c as { lesson_number?: number }).lesson_number!))]
    const subjectIds = [...new Set(needEnrich.map((c) => c.subject_id))]
    const gradeIds = [...new Set(needEnrich.map((c) => c.grade_level_id))]
    const textbookIds = [...new Set(needEnrich.map((c) => (c as { textbook_set_id?: string }).textbook_set_id).filter(Boolean) as string[])]
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
    const lessonOrders = [...new Set(needEnrich.map((c) => c.lesson_number!))]
    const subjectIds = [...new Set(needEnrich.map((c) => c.subject_id))]
    const gradeIds = [...new Set(needEnrich.map((c) => c.grade_level_id))]
    const textbookIds = [...new Set(needEnrich.map((c) => c.textbook_set_id).filter(Boolean) as string[])]
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
  return { success: true, worksheet: data }
}

/** Lấy danh sách phiếu bài tập thuộc một giáo trình (kể cả khi match từ giáo viên khác) */
export async function getWorksheetsByCurriculumId(curriculumId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, subject_id, grade_level_id, content_markdown, created_at')
    .eq('curriculum_id', curriculumId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
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

/** Đồng bộ quiz từ sourceSlides sang các bản còn lại (shared, original, personal) */
async function syncQuizAcrossVersions(
  curriculumId: string,
  sourceSlides: SlideItem[],
  opts: {
    supabase: ReturnType<typeof createClient>
    adminClient?: ReturnType<typeof createSupabaseClient>
    userId: string | null
    topic?: string
    subjectId?: string
    gradeLevelId?: string
  }
) {
  const { supabase, adminClient, userId } = opts
  const admin = adminClient ?? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
        .eq('curriculum_id', curriculumId)
    )
  }

  const newOriginal = applyQuizToSlides(Array.isArray(originalSlides) ? originalSlides : null)
  if (newOriginal && newOriginal.length > 0) {
    promises.push(admin.from('worksheet_slides_original').update({ content_json: newOriginal }).eq('curriculum_id', curriculumId))
  }

  const newPersonal = applyQuizToSlides(Array.isArray(personalSlides) ? personalSlides : null)
  if (newPersonal && newPersonal.length > 0 && userId) {
    promises.push(
      supabase
        .from('user_customized_slides')
        .update({ slides_json: newPersonal, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('curriculum_id', curriculumId)
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
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; teacherNotes?: string }>
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
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; teacherNotes?: string }>
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

/** Khôi phục bản chung từ lịch sử */
export async function restoreSharedFromHistory(curriculumId: string, historyId: string) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SHARED_HISTORY_DAYS)

  const { data, error } = await supabase
    .from('worksheet_slide_edit_history')
    .select('slides_json, created_at')
    .eq('id', historyId)
    .eq('curriculum_id', curriculumId)
    .single()

  if (error || !data) return { error: 'Không tìm thấy bản lưu.' }
  if (new Date(data.created_at) < cutoff) return { error: 'Bản lưu đã hết hạn khôi phục (7 ngày).' }

  const slides = data.slides_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; teacherNotes?: string }>
  if (!Array.isArray(slides) || slides.length === 0) return { error: 'Dữ liệu không hợp lệ.' }

  const { error: upsertErr } = await supabase
    .from('worksheet_slides')
    .upsert(
      {
        curriculum_id: curriculumId,
        user_id: null,
        content_json: slides,
      },
      { onConflict: 'curriculum_id' }
    )

  if (upsertErr) return { error: upsertErr.message }

  await supabase.from('worksheet_slide_edit_history').insert({
    curriculum_id: curriculumId,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    slides_json: slides,
  })

  return { success: true }
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
  slides: Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>; teacherNotes?: string }>
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

/** Áp dụng đề xuất khi có >= 5 người đồng ý – dùng service role để bypass RLS (voter không phải proposer) */
async function applySlideProposalIfEligible(supabase: ReturnType<typeof createSupabaseClient>, proposalId: string) {
  const { data: p } = await supabase
    .from('slide_edit_proposals')
    .select('id, curriculum_id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, agree_count, status')
    .eq('id', proposalId)
    .single()

  if (!p || p.status !== 'pending' || (p.agree_count ?? 0) < 5) return null

  const { data: slidesRow } = await supabase
    .from('worksheet_slides')
    .select('content_json, topic, subject_id, grade_level_id')
    .eq('curriculum_id', p.curriculum_id)
    .single()

  if (!slidesRow) return null

  const slides = slidesRow.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  if (!Array.isArray(slides)) return null

  const slide = slides[p.slide_index]
  if (!slide) return null

  const blocks = [...(slide.blocks ?? [])]
  if (p.segment_type === 'edit') {
    const block = blocks[p.block_index]
    if (!block || !p.original_text || !block.content.includes(p.original_text)) return null
    const newContent = block.content.replace(p.original_text, p.proposed_text)
    blocks[p.block_index] = { ...block, content: newContent }
  } else {
    const newBlock = { header: p.proposed_header ?? 'Nội dung bổ sung', content: p.proposed_text }
    blocks.splice(Math.min(p.block_index + 1, blocks.length), 0, newBlock)
  }

  const newSlides = slides.map((s, i) =>
    i === p.slide_index ? { ...s, blocks } : s
  )

  await supabase
    .from('worksheet_slides')
    .update({
      content_json: newSlides,
      topic: slidesRow.topic,
      subject_id: slidesRow.subject_id,
      grade_level_id: slidesRow.grade_level_id,
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
      topic: slidesRow.topic,
      subjectId: slidesRow.subject_id,
      gradeLevelId: slidesRow.grade_level_id,
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
async function applySlideProposalForce(supabase: ReturnType<typeof createSupabaseClient>, proposalId: string) {
  const { data: p } = await supabase
    .from('slide_edit_proposals')
    .select('id, curriculum_id, slide_index, block_index, segment_type, original_text, proposed_text, proposed_header, status')
    .eq('id', proposalId)
    .single()

  if (!p || p.status !== 'pending') return null

  const { data: slidesRow } = await supabase
    .from('worksheet_slides')
    .select('content_json, topic, subject_id, grade_level_id')
    .eq('curriculum_id', p.curriculum_id)
    .single()

  if (!slidesRow) return null

  const slides = slidesRow.content_json as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string; visualLayout?: 1 | 2 | 4; visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }> }>
  if (!Array.isArray(slides)) return null

  const slide = slides[p.slide_index]
  if (!slide) return null

  const blocks = [...(slide.blocks ?? [])]
  if (p.segment_type === 'edit') {
    const block = blocks[p.block_index]
    if (!block || !p.original_text || !block.content.includes(p.original_text)) return null
    const newContent = block.content.replace(p.original_text, p.proposed_text)
    blocks[p.block_index] = { ...block, content: newContent }
  } else {
    const newBlock = { header: p.proposed_header ?? 'Nội dung bổ sung', content: p.proposed_text }
    blocks.splice(Math.min(p.block_index + 1, blocks.length), 0, newBlock)
  }

  const newSlides = slides.map((s, i) =>
    i === p.slide_index ? { ...s, blocks } : s
  )

  await supabase
    .from('worksheet_slides')
    .update({
      content_json: newSlides,
      topic: slidesRow.topic,
      subject_id: slidesRow.subject_id,
      grade_level_id: slidesRow.grade_level_id,
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
      topic: slidesRow.topic,
      subjectId: slidesRow.subject_id,
      gradeLevelId: slidesRow.grade_level_id,
    })
  } catch (e) {
    console.warn('[applySlideProposalForce] Quiz sync failed:', e)
  }

  return true
}
