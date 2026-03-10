'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

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

const QUESTION_TYPE_NAMES: Record<string, string> = {
  'trac-nghiem': 'Trắc nghiệm 4 đáp án (A/B/C/D)',
  'dung-sai': 'Đúng / Sai',
  'tra-loi-ngan': 'Trả lời ngắn',
  'hon-hop': 'Hỗn hợp (trắc nghiệm + đúng/sai + trả lời ngắn)',
}

const TEXTBOOK_NAMES: Record<string, string> = {
  'ket-noi-tri-thuc': 'Kết nối tri thức với cuộc sống',
  'canh-dieu': 'Cánh diều',
  'chan-troi-sang-tao': 'Chân trời sáng tạo',
  khac: 'Không chỉ định',
}

/** Tạo đề trắc nghiệm theo format THPT 2025. */
export async function createExam(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const subjectId = (formData.get('subjectId') as string)?.trim() || 'toan'
  const gradeLevelId = (formData.get('gradeLevelId') as string)?.trim() || 'lop-12'
  const textbookSetId = (formData.get('textbookSetId') as string)?.trim() || 'ket-noi-tri-thuc'
  const topic = (formData.get('topic') as string)?.trim() || ''
  const numQuestions = Math.min(50, Math.max(5, parseInt(String(formData.get('numQuestions') || '15'), 10) || 15))
  const questionTypeId = (formData.get('questionTypeId') as string)?.trim() || 'trac-nghiem'
  const modelProvider = ((formData.get('modelProvider') as string)?.trim() || 'gemini') as 'gemini' | 'deepseek'

  if (!topic.trim()) {
    return { error: 'Vui lòng nhập chủ đề / nội dung đề thi.' }
  }

  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo đề thi.')
  if ('error' in result) return { error: result.error }

  const subjectName = SUBJECT_NAMES[subjectId] || subjectId
  const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac
  const questionTypeName = QUESTION_TYPE_NAMES[questionTypeId] || QUESTION_TYPE_NAMES['trac-nghiem']

  const isMenDePhuDinh = /mệnh\s*đề\s*phủ\s*định|phủ\s*định\s*mệnh\s*đề|mệnh\s*đề.*phủ\s*định/i.test(topic)
  const topicSpecificNote = isMenDePhuDinh
    ? `

### 4. LƯU Ý ĐẶC BIỆT – Mệnh đề phủ định
- Phân biệt rõ **nội dung phát biểu** và **giá trị chân lý** (Đúng/Sai).
- Tránh sử dụng các khái niệm đối lập không hoàn toàn như "số nguyên tố" và "hợp số" để làm phủ định của nhau (vì 1 không phải số nguyên tố cũng không phải hợp số).
- Mệnh đề phủ định phải phủ định toàn bộ nội dung mệnh đề gốc, không chỉ một phần.`
    : ''

  const prompt = `Bạn là chuyên gia ra đề thi cho giáo dục Việt Nam. Tạo đề thi theo FORMAT THPT 2025, bám sát cấu trúc mới của Bộ Giáo dục.

## THÔNG TIN ĐỀ THI
- **Môn:** ${subjectName}
- **Cấp độ:** ${gradeLabel}
- **Chủ đề / Nội dung:** ${topic}
- **Bộ sách:** ${textbookName}
- **Số câu:** ${numQuestions}
- **Loại câu:** ${questionTypeName}

## YÊU CẦU BẮT BUỘC

### 1. Ma trận nhận thức (Thang Bloom)
Phân bổ câu hỏi theo 4 mức:
- **Nhận biết:** ~20% – định nghĩa, công thức cơ bản, thuật ngữ
- **Thông hiểu:** ~30% – giải thích, so sánh, áp dụng trực tiếp
- **Vận dụng thấp:** ~30% – bài tập tổng hợp, biến đổi
- **Vận dụng cao:** ~20% – bài toán thực tiễn, phân tích, đánh giá

### 2. Cấu trúc đề theo loại câu
${questionTypeId === 'trac-nghiem' ? '- Tất cả câu trắc nghiệm 4 đáp án A/B/C/D. Mỗi câu có đúng 1 đáp án.' : ''}
${questionTypeId === 'dung-sai' ? '- Tất cả câu Đúng/Sai. Học sinh chọn Đúng hoặc Sai.' : ''}
${questionTypeId === 'tra-loi-ngan' ? '- Tất cả câu trả lời ngắn. Học sinh ghi đáp án (số, từ, cụm từ).' : ''}
${questionTypeId === 'hon-hop' ? '- Kết hợp: ~60% trắc nghiệm A/B/C/D, ~20% Đúng/Sai, ~20% trả lời ngắn.' : ''}

### 3. Format output
- Trả về Markdown, dùng ## cho phần, ### cho mục.
- Đánh số câu rõ ràng: **Câu 1.**, **Câu 2.**, ...
- CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode cho công thức, KHÔNG LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2. Căn: √(x+1). Ngôn ngữ: Tiếng Việt.
- Cuối đề: phần **ĐÁP ÁN** liệt kê đáp án từng câu (1. A, 2. B, ...).
- Nếu có câu trả lời ngắn: ghi đáp án cụ thể.
- Nếu có câu Đúng/Sai: ghi Đ hoặc S.
${topicSpecificNote}

Chỉ trả về nội dung đề thi + đáp án, không có lời giải thích thêm.`

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
            { role: 'system', content: 'Bạn là chuyên gia ra đề thi cho giáo dục Việt Nam. Trả về đúng nội dung Markdown theo yêu cầu, không thêm giải thích.' },
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
      text = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    } else {
      const apiKey = process.env.GOOGLE_API_KEY
      if (!apiKey) return { error: 'Thiếu GOOGLE_API_KEY.' }
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
      const genResult = await model.generateContent(prompt)
      text = genResult.response.text()?.trim() || ''
    }

    if (!text) return { error: 'AI không trả về đề thi.' }
    return { success: true, examMarkdown: text }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Tạo đề thi thất bại: ${msg}` }
  }
}
