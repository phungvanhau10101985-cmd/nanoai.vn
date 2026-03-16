import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'

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

const MAX_IMAGES = 10

/** Tạo giáo trình từ nội dung đã dán + ảnh (sơ đồ, hình) – copy từ PDF không copy được sơ đồ nên cần ảnh bổ sung */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const pastedContent = (formData.get('pastedContent') as string)?.trim() || ''
    const subjectId = String(formData.get('subjectId') || 'toan').trim()
    const gradeLevelId = String(formData.get('gradeLevelId') || 'lop-6').trim()
    const topic = (formData.get('topic') as string)?.trim() || ''
    const numLessons = Math.min(10, Math.max(1, parseInt(String(formData.get('numLessons') || '3'), 10)))
    const lessonDurationMinutes = Math.min(120, Math.max(15, parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10)))
    const goals = (formData.get('goals') as string)?.trim() || ''

    if (!pastedContent || pastedContent.length < 100) {
      return NextResponse.json(
        { error: 'Vui lòng dán nội dung sách (ít nhất 100 ký tự).' },
        { status: 400 }
      )
    }

    const images = formData.getAll('images') as File[]
    const files = images.filter((f) => f && typeof f === 'object' && f.size > 0).slice(0, MAX_IMAGES)
    const hasImages = files.length > 0

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const subjectName = SUBJECT_NAMES[subjectId] || subjectId
    const gradeLabel = gradeLevelId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    const numTiet = numLessons
    const thoiLuong = lessonDurationMinutes

    const prompt = hasImages
      ? `Đây là nội dung trích từ sách giáo khoa (người dùng đã dán) VÀ ${files.length} ảnh kèm theo (sơ đồ, hình, bảng – copy từ PDF không copy được nên gửi ảnh riêng).

NỘI DUNG SÁCH ĐÃ DÁN:
---
${pastedContent.slice(0, 10000)}
---

Kèm theo ${files.length} ảnh (sơ đồ, hình minh họa, bảng biến thiên, đồ thị...). Hãy xem ảnh và mô tả chi tiết nội dung trong ảnh khi soạn giáo trình – đặc biệt các sơ đồ, hình vẽ quan trọng mà text không có.

Thông tin bổ sung:
- Môn: ${subjectName}
- Cấp độ: ${gradeLabel}
- Thời lượng: ${numTiet} tiết x ${thoiLuong} phút.
- Đối tượng: Học sinh Việt Nam theo chương trình GDPT 2018.
${topic ? `- Chủ đề/tên bài: ${topic}` : ''}
${goals ? `- Mục tiêu bổ sung: ${goals}` : ''}

CẤU TRÚC BẮT BUỘC (theo Công văn 5512/BGDĐT):
1. Khởi động – kích thích hứng thú, kết nối kiến thức cũ.
2. Hình thành kiến thức – nội dung từ text đã dán + mô tả chi tiết nội dung trong ảnh (sơ đồ, hình, bảng).
3. Luyện tập – vận dụng, bài tập, thực hành.
4. Vận dụng – mở rộng, liên hệ thực tế.

FORMAT BẮT BUỘC:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN BÀI VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${thoiLuong} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)**
- HÌNH ẢNH: Mỗi ảnh phải được mô tả rõ (ví dụ: "Hình 1 – sơ đồ quy trình...", "Hình 2 – đồ thị y = x²...") để người đọc hiểu mà không cần xem ảnh.
- CÔNG THỨC: Unicode, KHÔNG LaTeX. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, y=x², f'(x). Phân số: 1/2 hoặc ½.

Yêu cầu:
- Bám sát nội dung đã dán và mô tả đầy đủ nội dung trong ảnh.
- Chuẩn Bộ GD&ĐT: Công văn 5512, GDPT 2018.
- Trả về Markdown, dùng ## ### **. Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không giải thích thêm.`
      : `Đây là nội dung trích từ sách giáo khoa (người dùng đã dán vào). Hãy chuyển thành GIÁO TRÌNH chi tiết theo đúng Công văn 5512/BGDĐT.

NỘI DUNG SÁCH ĐÃ DÁN:
---
${pastedContent.slice(0, 12000)}
---

Thông tin bổ sung:
- Môn: ${subjectName}
- Cấp độ: ${gradeLabel}
- Thời lượng: ${numTiet} tiết x ${thoiLuong} phút.
- Đối tượng: Học sinh Việt Nam theo chương trình GDPT 2018.
${topic ? `- Chủ đề/tên bài: ${topic}` : ''}
${goals ? `- Mục tiêu bổ sung: ${goals}` : ''}

CẤU TRÚC BẮT BUỘC (theo Công văn 5512/BGDĐT):
1. Khởi động – kích thích hứng thú, kết nối kiến thức cũ.
2. Hình thành kiến thức – nội dung mới từ sách đã dán, lý thuyết.
3. Luyện tập – vận dụng, bài tập, thực hành.
4. Vận dụng – mở rộng, liên hệ thực tế.

FORMAT BẮT BUỘC:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN BÀI VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${thoiLuong} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)**
- CÔNG THỨC: Unicode, KHÔNG LaTeX. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, y=x², f'(x). Phân số: 1/2 hoặc ½.

Yêu cầu:
- Bám sát 100% nội dung đã dán.
- Chuẩn Bộ GD&ĐT: Công văn 5512, GDPT 2018.
- Trả về Markdown, dùng ## ### **. Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không giải thích thêm.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ ...GEMINI_25_PRO, generationConfig: { temperature: 0.3 } })

    let text: string
    if (hasImages) {
      const imageParts = await Promise.all(
        files.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer())
          const mimeType = file.type || 'image/png'
          return { inlineData: { data: buffer.toString('base64'), mimeType } }
        })
      )
      const result = await model.generateContent([prompt, ...imageParts])
      text = result.response.text()?.trim() || ''
    } else {
      const result = await model.generateContent(prompt)
      text = result.response.text()?.trim() || ''
    }

    const cleaned = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    if (!cleaned) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }

    const extractedTopic =
      topic ||
      cleaned.match(/^#+\s*GIÁO TRÌNH:\s*(.+?)(?:\n|$)/im)?.[1]?.trim() ||
      cleaned.match(/^#+\s*(.+?)(?:\n|$)/m)?.[1]?.trim() ||
      'Giáo trình từ nội dung sách'

    return NextResponse.json({
      curriculumMarkdown: cleaned,
      topic: extractedTopic,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-from-paste]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
