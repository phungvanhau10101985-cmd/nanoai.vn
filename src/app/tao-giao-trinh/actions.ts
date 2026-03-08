'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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

/** Tạo giáo trình bằng AI cho mọi môn học. */
export async function createCurriculum(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  const textbookSetId = (formData.get('textbookSetId') as string)?.trim() || 'ket-noi-tri-thuc'
  const lessonTypeId = (formData.get('lessonTypeId') as string)?.trim() || 'hinh-thanh-kien-thuc'
  const topic = (formData.get('topic') as string)?.trim() || ''
  const numLessons = parseInt(String(formData.get('numLessons') || '5'), 10) || 5
  const lessonDurationMinutes = parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10) || 45
  const modelProvider = ((formData.get('modelProvider') as string)?.trim() || 'gemini') as 'gemini' | 'deepseek'
  const goals = (formData.get('goals') as string)?.trim() || ''

  if (!topic.trim()) {
    return { error: 'Vui lòng nhập chủ đề / bài học.' }
  }

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac
  const lessonTypeName = LESSON_TYPE_NAMES[lessonTypeId] || LESSON_TYPE_NAMES['hinh-thanh-kien-thuc']

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo giáo trình.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const numTiet = Math.min(10, Math.max(1, numLessons))
  const thoiLuong = Math.min(120, Math.max(15, lessonDurationMinutes))

  const isMenDePhuDinh = /mệnh\s*đề\s*phủ\s*định|phủ\s*định\s*mệnh\s*đề|mệnh\s*đề.*phủ\s*định/i.test(topic)
  const curriculumMenDeNote = isMenDePhuDinh
    ? `

LƯU Ý ĐẶC BIỆT (Mệnh đề phủ định): Phân biệt rõ nội dung phát biểu và giá trị chân lý (Đúng/Sai). Tránh dùng khái niệm đối lập không hoàn toàn như "số nguyên tố" và "hợp số" làm phủ định của nhau (vì 1 không phải số nguyên tố cũng không phải hợp số).`
    : ''

  const prompt = `Hãy soạn giáo trình cho bài "${topic}", môn ${subjectName}, ${gradeLabel}, bộ sách ${textbookName}.

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

Lưu ý theo loại bài:
- Bài hình thành kiến thức mới: tập trung lý thuyết + thí nghiệm minh họa.
- Bài luyện tập/Ôn tập: tập trung phương pháp giải bài tập, hệ thống hóa.
- Bài thực hành: tập trung quy trình thí nghiệm, an toàn, báo cáo.
${curriculumMenDeNote}

Yêu cầu format:
- Trả về Markdown, dùng ## cho tiêu đề bài, ### cho mục con, - cho bullet list.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không có lời giải thích thêm.`

  try {
    let text = ''

    if (modelProvider === 'deepseek') {
      const deepSeekApiKey = String(process.env.DEEPSEEK_API_KEY || '').trim()
      if (!deepSeekApiKey) return { error: 'Thiếu DEEPSEEK_API_KEY. Vui lòng cấu hình API.' }
      const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim() || 'deepseek-chat'
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepSeekApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: 'Bạn là chuyên gia thiết kế giáo trình theo Công văn 5512/BGDĐT. Trả về đúng nội dung Markdown theo yêu cầu, không thêm giải thích.' },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        return { error: `DeepSeek API lỗi ${res.status}: ${errBody.slice(0, 200)}` }
      }
      const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
      text = String(data?.choices?.[0]?.message?.content || '').trim()
      // Strip markdown code block wrapper nếu có
      text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    } else {
      const apiKey = process.env.GOOGLE_API_KEY
      if (!apiKey) return { error: 'Thiếu GOOGLE_API_KEY. Vui lòng cấu hình API.' }
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
      const genResult = await model.generateContent(prompt)
      text = genResult.response.text()?.trim() || ''
    }

    if (!text) return { error: 'AI không trả về nội dung.' }

    const { data: row, error: insertErr } = await supabase
      .from('worksheet_curricula')
      .insert({
        user_id: user?.id ?? null,
        topic: topic.trim(),
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        textbook_set_id: textbookSetId,
        lesson_type_id: lessonTypeId,
        num_lessons: numTiet,
        lesson_duration_minutes: thoiLuong,
        goals: goals.trim() || null,
        content_markdown: text,
      })
      .select('id')
      .single()

    if (insertErr) {
      return { success: true, curriculumMarkdown: text, curriculumId: null }
    }
    return { success: true, curriculumMarkdown: text, curriculumId: row?.id ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Tạo giáo trình thất bại: ${msg}` }
  }
}

/** Tạo Phiếu bài tập đi kèm giáo trình – phân hóa 4 mức độ nhận thức. */
export async function createWorksheet(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const curriculumMarkdown = (formData.get('curriculumMarkdown') as string)?.trim() || ''
  const topic = (formData.get('topic') as string)?.trim() || ''
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-6'
  const modelProvider = ((formData.get('modelProvider') as string)?.trim() || 'gemini') as 'gemini' | 'deepseek'

  if (!curriculumMarkdown) {
    return { error: 'Vui lòng tạo giáo trình trước khi tạo phiếu bài tập.' }
  }

  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo phiếu bài tập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const isMenDePhuDinh = /mệnh\s*đề\s*phủ\s*định|phủ\s*định\s*mệnh\s*đề|mệnh\s*đề.*phủ\s*định/i.test(topic)
  const menDePhuDinhNote = isMenDePhuDinh
    ? `\n\n**LƯU Ý – Mệnh đề phủ định:** Phân biệt rõ nội dung phát biểu và giá trị chân lý (Đúng/Sai). Tránh dùng khái niệm đối lập không hoàn toàn như "số nguyên tố" và "hợp số" làm phủ định của nhau.`
    : ''

  const systemPrompt = `Bạn là chuyên gia soạn phiếu bài tập cho giáo viên Việt Nam. Trả về đúng nội dung Markdown theo yêu cầu, không thêm giải thích. Dùng LaTeX inline cho công thức toán/lý (ví dụ: $y = x^2$, $F = ma$).`

  const userPrompt = `Dựa trên giáo trình dưới đây, hãy soạn một PHIẾU BÀI TẬP chuyên nghiệp cho học sinh.

## GIÁO TRÌNH THAM KHẢO
${curriculumMarkdown.slice(0, 8000)}

---

## YÊU CẦU PHIẾU BÀI TẬP

**Chủ đề:** ${topic}
**Môn:** ${subjectName}
**Cấp độ:** ${gradeLabel}
${menDePhuDinhNote}

**Cấu trúc bắt buộc (phân hóa 4 mức độ nhận thức theo Thang Bloom):**

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
- Lời giải chi tiết từng bước cho tất cả bài tự luận, kèm giải thích ngắn gọn.

**Format:** Markdown, dùng ## cho phần, ### cho mục con. Công thức dùng LaTeX $...$. Ngôn ngữ: Tiếng Việt.

**QUAN TRỌNG – Viết cho học sinh dễ đọc:**
- Phân số đơn giản: viết $\\frac{1}{2}$ hoặc 1/2, KHÔNG viết ((1)/(2)) hay ngoặc thừa.
- Hàm số: viết y(1/2) thay vì y((1)/(2)).
- Trong căn: viết $\\sqrt{\\frac{1}{4} - \\frac{1}{2} + 1}$ hoặc √(1/4 - 1/2 + 1), dùng ngoặc tròn ) đóng, KHÔNG dùng } thay cho ).
- Mỗi bước tính nên xuống dòng, tránh viết quá dài trên một dòng.

Chỉ trả về nội dung phiếu bài tập, không có lời giải thích thêm.`

  try {
    let text = ''

    if (modelProvider === 'deepseek') {
      const deepSeekApiKey = String(process.env.DEEPSEEK_API_KEY || '').trim()
      if (!deepSeekApiKey) return { error: 'Thiếu DEEPSEEK_API_KEY.' }
      const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim() || 'deepseek-chat'
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepSeekApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        return { error: `DeepSeek API lỗi ${res.status}: ${errBody.slice(0, 200)}` }
      }
      const data = (await res.json().catch(() => ({}))) as { choices?: Array<{ message?: { content?: string } }> }
      text = String(data?.choices?.[0]?.message?.content || '').trim()
      text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    } else {
      const apiKey = process.env.GOOGLE_API_KEY
      if (!apiKey) return { error: 'Thiếu GOOGLE_API_KEY.' }
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
      const fullPrompt = `[Hướng dẫn hệ thống]\n${systemPrompt}\n\n[Yêu cầu]\n${userPrompt}`
      const genResult = await model.generateContent(fullPrompt)
      text = genResult.response.text()?.trim() || ''
    }

    if (!text) return { error: 'AI không trả về phiếu bài tập.' }

    const { data: row, error: insertErr } = await supabase
      .from('worksheet_worksheets')
      .insert({
        user_id: user?.id ?? null,
        topic: topic || 'Phiếu bài tập',
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        content_markdown: text,
      })
      .select('id')
      .single()

    if (insertErr) {
      return { success: true, worksheetMarkdown: text, worksheetId: null }
    }
    return { success: true, worksheetMarkdown: text, worksheetId: row?.id ?? null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Tạo phiếu bài tập thất bại: ${msg}` }
  }
}

/** Danh sách giáo trình đã lưu – để giáo viên browse và reuse */
export async function listCurricula(opts?: { subjectId?: string; gradeLevelId?: string; limit?: number }) {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem danh sách giáo trình.')
  if ('error' in authResult) return { error: authResult.error }

  let q = supabase
    .from('worksheet_curricula')
    .select('id, topic, subject_id, grade_level_id, textbook_set_id, lesson_type_id, num_lessons, lesson_duration_minutes, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(100, opts?.limit ?? 50))

  if (opts?.subjectId) q = q.eq('subject_id', opts.subjectId)
  if (opts?.gradeLevelId) q = q.eq('grade_level_id', opts.gradeLevelId)

  const { data, error } = await q
  if (error) return { error: error.message }
  return { success: true, items: data ?? [] }
}

/** Lấy chi tiết giáo trình theo id */
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
