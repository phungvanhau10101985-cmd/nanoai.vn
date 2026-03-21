import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import { generateSlidesFromCurriculum } from '@/lib/slides-from-curriculum'

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

const TEXTBOOK_NAMES: Record<string, string> = {
  'ket-noi-tri-thuc': 'Kết nối tri thức với cuộc sống',
  'canh-dieu': 'Cánh diều',
  'chan-troi-sang-tao': 'Chân trời sáng tạo',
  khac: 'Không chỉ định',
}

/** Giới hạn số ảnh – Gemini API có giới hạn ~20MB/request; 10 ảnh an toàn cho mọi model */
const MAX_IMAGES = 10

/** Tạo giáo trình từ ảnh trang sách giáo khoa – dùng Gemini vision */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const images = formData.getAll('images') as File[]
    let files = images.filter((f) => f && typeof f === 'object' && f.size > 0)
    if (files.length === 0) {
      const single = formData.get('image') as File | null
      if (single && single.size > 0) files = [single]
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Tối đa ${MAX_IMAGES} ảnh. Vui lòng chọn lại.` },
        { status: 400 }
      )
    }
    const subjectId = String(formData.get('subjectId') || 'toan').trim()
    const gradeLevelId = String(formData.get('gradeLevelId') || 'lop-12').trim()
    const textbookSetId = String(formData.get('textbookSetId') || 'ket-noi-tri-thuc').trim()
    const lessonNumber = parseInt(String(formData.get('lessonNumber') || '1'), 10)
    const numLessons = Math.min(10, Math.max(1, parseInt(String(formData.get('numLessons') || '3'), 10)))
    const lessonDurationMinutes = Math.min(120, Math.max(15, parseInt(String(formData.get('lessonDurationMinutes') || '45'), 10)))

    if (files.length === 0) {
      return NextResponse.json({ error: 'Vui lòng gửi ảnh trang sách.' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const subjectName = SUBJECT_NAMES[subjectId] || subjectId
    const textbookName = TEXTBOOK_NAMES[textbookSetId] || TEXTBOOK_NAMES.khac

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_PRO,
      generationConfig: { temperature: 0.3 },
    })

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer())
        const mimeType = file.type || 'image/png'
        return {
          inlineData: { data: buffer.toString('base64'), mimeType },
        }
      })
    )

    const imgLabel = files.length > 1 ? `${files.length} ảnh trang sách` : 'ảnh trang sách'
    const prompt = `Đây là ${imgLabel} giáo khoa ${subjectName} ${gradeLevelId}, bộ ${textbookName}.

BƯỚC 1 – Trích thông tin từ ảnh (ưu tiên ảnh đầu):
- Xác định SỐ BÀI (1, 2, 3...) và TÊN BÀI ghi trong trang sách.
- Dòng đầu tiên trả về (bắt buộc): BÀI_SỐ: <số>
Dòng thứ hai: BÀI_TÊN: <tên bài đầy đủ>
Ví dụ:
BÀI_SỐ: 2
BÀI_TÊN: Tích phân

BƯỚC 2 – Soạn giáo trình:
Dựa trên nội dung trong ${files.length > 1 ? 'các ảnh (đọc theo thứ tự trang, tổng hợp đầy đủ)' : 'ảnh'}, soạn GIÁO TRÌNH chi tiết theo đúng Công văn 5512/BGDĐT và chương trình GDPT 2018 của Bộ Giáo dục và Đào tạo.

Thông số:
- Thời lượng: ${numLessons} tiết x ${lessonDurationMinutes} phút.
- Đối tượng: Học sinh Việt Nam theo chương trình GDPT 2018.

CẤU TRÚC BẮT BUỘC (theo Công văn 5512/BGDĐT – 4 hoạt động mỗi tiết):
1. Khởi động – kích thích hứng thú, kết nối kiến thức cũ.
2. Hình thành kiến thức – nội dung mới từ sách, lý thuyết.
3. Luyện tập – vận dụng, bài tập.
4. Vận dụng – mở rộng, liên hệ thực tế.

FORMAT BẮT BUỘC:
- Tiêu đề chính: ## GIÁO TRÌNH: <TÊN BÀI VIẾT HOA>
- Mỗi tiết: ### Tiết X: <tiêu đề tiết> (tổng ${lessonDurationMinutes} phút)
- Mỗi hoạt động: **1. Khởi động (X phút)**, **2. Hình thành kiến thức (X phút)**, **3. Luyện tập (X phút)**, **4. Vận dụng (X phút)** – tổng 4 hoạt động = ${lessonDurationMinutes} phút.
- Trong mỗi hoạt động, tách thành CÁC PHẦN – mỗi phần ghi rõ thời lượng: **Phần 1 (X phút):**, **Phần 2 (X phút):**, ... Tổng thời lượng các phần trong mỗi hoạt động phải bằng thời lượng hoạt động đó.
- Ghi rõ tham chiếu SGK: trang X, Hình X, Ví dụ X, HĐX (Hoạt động), Luyện tập X, Vận dụng X, Bài tập X

YÊU CẦU CHI TIẾT (bắt buộc):
- HÌNH ẢNH: Mỗi khi nhắc Hình X, phải mô tả nội dung (ví dụ: "Hình 1.2 – đồ thị hàm số y = x²", "Hình 1.4 – bảng biến thiên", "sơ đồ quy trình...") để người đọc hiểu mà không cần xem ảnh.
- CÔNG THỨC – CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG dùng LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2. Căn: √(x+1). Bảng: +∞, −∞, ‖.
- BẢNG: Trích nội dung bảng quan trọng (ít nhất các hàng/cột chính). Không bỏ qua bảng trong SGK.
- ĐỘ CHI TIẾT: Mỗi hoạt động chia thành các phần (Phần 1, Phần 2, ...), mỗi phần gọn một ý – ví dụ một ví dụ, một bài tập – không gộp nhiều ý vào một đoạn dài. Mỗi phần phải ghi cụ thể thời lượng (phút). Ví dụ: **Phần 1 (5 phút):** Thực hiện HĐ1 (trang 2): Quan sát đồ thị Hình 1.2, nhận xét... **Phần 2 (3 phút):** Đặt vấn đề: Làm thế nào để...

Yêu cầu:
- Bám sát 100% nội dung sách giáo khoa trong ảnh – không thêm bớt, không sai lệch.
- Chuẩn Bộ GD&ĐT: Công văn 5512, GDPT 2018.
- Trả về Markdown, dùng ## ### ** - cho cấu trúc.
- Ngôn ngữ: Tiếng Việt.
- Chỉ trả về nội dung Markdown, không giải thích thêm.
- QUAN TRỌNG: Kết quả cho học sinh đọc trực tiếp – dùng Unicode, không LaTeX.`

    const result = await model.generateContent([prompt, ...imageParts])
    const text = result.response.text()?.trim() || ''
    const cleaned = text.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    if (!cleaned) {
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }

    let extractedLessonNumber = lessonNumber
    let extractedTitle = `Bài ${lessonNumber}`

    const numMatch = cleaned.match(/BÀI_SỐ:\s*(\d+)/i)
    if (numMatch) {
      extractedLessonNumber = parseInt(numMatch[1], 10) || lessonNumber
    }
    const titleMatch = cleaned.match(/BÀI_TÊN:\s*(.+?)(?:\n|$)/i)
    if (titleMatch) {
      const raw = titleMatch[1].trim()
      if (raw) {
        extractedTitle = /^bài\s*\d+/i.test(raw) ? raw : `Bài ${extractedLessonNumber}: ${raw}`
      } else {
        extractedTitle = `Bài ${extractedLessonNumber}`
      }
    } else {
      const topicMatch = cleaned.match(/^#+\s*(.+?)(?:\n|$)/m)
      extractedTitle = topicMatch ? topicMatch[1].trim() : `Bài ${extractedLessonNumber}`
    }

    const curriculumBody = cleaned
      .replace(/^BÀI_SỐ:\s*\d+\s*\n?/im, '')
      .replace(/^BÀI_TÊN:\s*.+?\n?/im, '')
      .replace(/^\s*\n+/, '')
      .trim()

    const { slides } = await generateSlidesFromCurriculum(curriculumBody, extractedTitle, { fetchImages: true })
    const slidesPrepared = (slides as Array<{ title: string; blocks: Array<{ header: string; content: string }>; imageUrl?: string; visualEmbed?: string }>)

    return NextResponse.json({
      curriculumMarkdown: curriculumBody,
      topic: extractedTitle,
      lessonNumber: extractedLessonNumber,
      lessonTitle: extractedTitle,
      slides: slidesPrepared.length > 0 ? slidesPrepared : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-from-image]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
