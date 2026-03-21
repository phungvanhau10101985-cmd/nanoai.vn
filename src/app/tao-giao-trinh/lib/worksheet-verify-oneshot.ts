/**
 * Verify câu hỏi (trắc nghiệm + tự luận).
 * Dùng Gemini 2.5 Flash để verify nhanh; Gemini 2.5 Pro để verify/sửa lại khi cần.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { normalizeSolutionToStr } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

const QUIZ_VERIFY_PROMPT = `Đối chiếu GIÁO TRÌNH với câu hỏi trắc nghiệm đã có. Nếu SAI – BẮT BUỘC trả về các trường đã sửa theo đúng tài liệu. Sai ở đâu sửa ở đó, KHÔNG tạo câu mới, KHÔNG lấy câu khác từ giáo trình – chỉ sửa đúng câu đã cho.

CẤM câu hỏi thiếu phần mở đầu và phần đặt câu hỏi – phải có: (1) phần mở đầu/ngữ cảnh (Cho hàm số..., Cho bảng...), (2) phần đặt câu hỏi rõ ràng. CẤM mở đầu bằng bảng/số. Nếu thiếu → verified:false và BẮT BUỘC trả về question đã sửa (thêm phần mở đầu và/hoặc phần đặt câu hỏi).

BÀI CĂN CỨ ĐỒ THỊ/HÌNH SGK: Nếu câu hỏi yêu cầu đọc đồ thị, hình vẽ, ảnh minh họa (vd: "có đồ thị cho ở Hình", "Hình 1.11", "dựa vào đồ thị", "quan sát hình") thì đáp án/lời giải logic phải KHỚP với việc đọc từ hình, không được chấp nhận nếu chỉ suy luận giải tích trên giấy mà mâu thuẫn với những gì SGK thể hiện trên hình (khi bạn có đủ ngữ cảnh từ giáo trình). Nếu không có ảnh SGK trong ngữ cảnh này mà bắt buộc phải nhìn ảnh mới chấm được → needsImage:true.

QUAN TRỌNG – needsImage: Nếu câu hỏi YÊU CẦU nhìn đồ thị/hình/ảnh trong SGK để trả lời và bạn KHÔNG CÓ ảnh gốc để xem → trả về needsImage:true. Khi đó câu sẽ được verify bằng model có vision với ảnh SGK gốc.

GIÁO TRÌNH:
---
{curriculum}
---

CÂU HỎI: {question}

A. {optA}
B. {optB}
C. {optC}
D. {optD}

Đáp án hiện tại: {correctLabel} ({correctText})

Trả về JSON:
- verified:true nếu mọi thứ đúng.
- verified:false thì BẮT BUỘC điền ít nhất correctIndex (0-3). Nếu câu hỏi/đáp án sai thì thêm question và/hoặc options (mảng 4 phần tử). Không được để trống khi sai.
- needsImage:true nếu câu cần ảnh gốc mới verify được (câu nhìn hình/đồ thị).`

const ESSAY_VERIFY_PROMPT = `Bạn là giáo viên kiểm tra chất lượng. Đối chiếu GIÁO TRÌNH với đề bài và lời giải đã có. Nếu SAI – BẮT BUỘC trả về các trường đã sửa theo đúng tài liệu. Sai ở đâu sửa ở đó, KHÔNG tạo bài mới, KHÔNG lấy bài khác từ giáo trình – chỉ sửa đúng bài đã cho.

ĐỀ CĂN CỨ ĐỒ THỊ / HÌNH SGK (rất quan trọng):
- Nếu đề bài yêu cầu căn cứ vào đồ thị hoặc hình trong sách (vd: "có đồ thị như sau", "đồ thị cho ở Hình", "Hình 1.11", "H.1.11", "quan sát đồ thị", "theo hình vẽ") thì lời giải HỢP LỆ phải thể hiện rõ là đọc kết quả từ đồ thị/hình (vd: có câu dạng "Dựa vào đồ thị", "Từ hình vẽ ta thấy", mô tả chiều tăng/giảm, cực trị, giao điểm đọc được trên trục hoặc ghi chú trên hình).
- verified:false nếu lời giải CHỈ dùng đạo hàm / bảng biến thiên thuần giải tích mà BỎ QUA yêu cầu đọc đồ thị trong đề (coi bài như toán text-only) — đó là SAI so với đề bài SGK. Khi sửa, trả về solution (và problem nếu cần) đúng phương pháp: căn cứ đồ thị/hình như SGK yêu cầu.
- Nếu đề chỉ cho hàm số và không gợi ý "hình/đồ thị" thì có thể chấp nhận lời giải giải tích chuẩn.

QUAN TRỌNG – needsImage: Nếu đề bài YÊU CẦU nhìn đồ thị/hình/ảnh trong SGK để chấm đúng và bạn KHÔNG CÓ ảnh gốc trong ngữ cảnh → trả về needsImage:true. Khi đó bài sẽ được verify bằng model có vision với ảnh SGK gốc.

GIÁO TRÌNH:
---
{curriculum}
---

ĐỀ BÀI:
---
{problem}
---

LỜI GIẢI:
---
{solution}
---

Trả về JSON:
- verified:true nếu mọi thứ đúng.
- verified:false thì BẮT BUỘC điền problem và/hoặc solution đã sửa. Không được để trống khi sai.
- needsImage:true nếu bài cần ảnh gốc mới verify được (bài nhìn hình/đồ thị).`

function parseQuizVerify(raw: string): { verified: boolean; needsImage?: boolean; correctIndex?: number; question?: string; options?: string[] } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const v = JSON.parse(cleaned) as { verified?: boolean; needsImage?: boolean; correctIndex?: number; question?: string; options?: string[] }
    return {
      verified: v.verified === true,
      needsImage: v.needsImage === true,
      correctIndex: typeof v.correctIndex === 'number' && v.correctIndex >= 0 && v.correctIndex <= 3 ? v.correctIndex : undefined,
      question: typeof v.question === 'string' ? v.question : undefined,
      options: Array.isArray(v.options) && v.options.length >= 4 ? v.options.slice(0, 4) : undefined,
    }
  } catch {
    return null
  }
}

function parseEssayVerify(raw: string): { verified: boolean; needsImage?: boolean; reason?: string; problem?: string; solution?: string } | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    const v = JSON.parse(cleaned) as { verified?: boolean; needsImage?: boolean; reason?: string; problem?: string; solution?: unknown }
    const solution = normalizeSolutionToStr(v.solution) || (typeof v.solution === 'string' ? v.solution : undefined)
    return {
      verified: v.verified === true,
      needsImage: v.needsImage === true,
      reason: v.reason,
      problem: typeof v.problem === 'string' ? v.problem : undefined,
      solution: solution || undefined,
    }
  } catch {
    return null
  }
}

/** Verify câu trắc nghiệm bằng Gemini 2.5 Flash (giữ tên hàm cũ để tương thích). */
export async function verifyQuizWithDeepSeek(
  curriculum: string,
  q: { question: string; options: string[]; correctIndex: number }
): Promise<{ verified: boolean; needsImage?: boolean; correctIndex?: number; question?: string; options?: string[] } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const opts = q.options ?? []
  const prompt = QUIZ_VERIFY_PROMPT.replace('{curriculum}', curriculum.slice(0, 3000))
    .replace('{question}', q.question)
    .replace('{optA}', opts[0] ?? '')
    .replace('{optB}', opts[1] ?? '')
    .replace('{optC}', opts[2] ?? '')
    .replace('{optD}', opts[3] ?? '')
    .replace('{correctLabel}', String.fromCharCode(65 + q.correctIndex))
    .replace('{correctText}', opts[q.correctIndex] ?? '')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const raw = result.response.text()?.trim() || ''
  return raw ? parseQuizVerify(raw) : null
}

/** Verify bài tự luận bằng Gemini 2.5 Flash (giữ tên hàm cũ để tương thích). */
export async function verifyEssayWithDeepSeek(
  curriculum: string,
  problem: string,
  solution: string
): Promise<{ verified: boolean; needsImage?: boolean; reason?: string; problem?: string; solution?: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const prompt = ESSAY_VERIFY_PROMPT.replace('{curriculum}', curriculum.slice(0, 3000))
    .replace('{problem}', problem)
    .replace('{solution}', solution)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const raw = result.response.text()?.trim() || ''
  return raw ? parseEssayVerify(raw) : null
}

/** Verify câu trắc nghiệm bằng Gemini 2.5 Flash – dùng để xác minh lại khi cần. */
export async function verifyQuizWithGemini(
  curriculum: string,
  q: { question: string; options: string[]; correctIndex: number }
): Promise<{ verified: boolean; correctIndex?: number; question?: string; options?: string[] } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const opts = q.options ?? []
  const prompt = QUIZ_VERIFY_PROMPT.replace('{curriculum}', curriculum.slice(0, 3000))
    .replace('{question}', q.question)
    .replace('{optA}', opts[0] ?? '')
    .replace('{optB}', opts[1] ?? '')
    .replace('{optC}', opts[2] ?? '')
    .replace('{optD}', opts[3] ?? '')
    .replace('{correctLabel}', String.fromCharCode(65 + q.correctIndex))
    .replace('{correctText}', opts[q.correctIndex] ?? '')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const raw = result.response.text()?.trim() || ''
  return raw ? parseQuizVerify(raw) : null
}

/** Verify bài tự luận bằng Gemini 2.5 Flash – dùng để xác minh lại khi cần. */
export async function verifyEssayWithGemini(
  curriculum: string,
  problem: string,
  solution: string
): Promise<{ verified: boolean; problem?: string; solution?: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const prompt = ESSAY_VERIFY_PROMPT.replace('{curriculum}', curriculum.slice(0, 3000))
    .replace('{problem}', problem)
    .replace('{solution}', solution)
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent(prompt)
  const raw = result.response.text()?.trim() || ''
  return raw ? parseEssayVerify(raw) : null
}

/** Verify câu trắc nghiệm bằng Gemini 2.5 Flash + ảnh SGK – khi cần nhìn ảnh. */
export async function verifyQuizWithGeminiVision(
  curriculum: string,
  q: { question: string; options: string[]; correctIndex: number },
  imageParts: Array<{ inlineData: { data: string; mimeType: string } }>
): Promise<{ verified: boolean; correctIndex?: number; question?: string; options?: string[] } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey || imageParts.length === 0) return null
  const opts = q.options ?? []
  const prompt = `Đây là ảnh (các ảnh) trang bài tập SGK. Đối chiếu với câu hỏi trắc nghiệm đã trích xuất; chấm và sửa theo đúng ảnh + giáo trình.

GIÁO TRÌNH:
---
${curriculum.slice(0, 3000)}
---

CÂU ĐÃ TRÍCH XUẤT:
${q.question}
A. ${opts[0] ?? ''}
B. ${opts[1] ?? ''}
C. ${opts[2] ?? ''}
D. ${opts[3] ?? ''}
Đáp án hiện tại: ${String.fromCharCode(65 + q.correctIndex)}

Nhiệm vụ:
- Nếu câu hỏi yêu cầu đọc đồ thị/hình trên ảnh: đáp án phải khớp với những gì ĐỌC ĐƯỢC từ hình (khoảng đồng biến/nghịch biến, giá trị tại điểm đặc biệt, v.v.). Không chấp nhận đáp án chỉ suy từ công thức nếu mâu thuẫn hình SGK.
- Nếu câu đúng với ảnh và giáo trình → verified:true.
- Nếu SAI → verified:false và BẮT BUỘC trả về correctIndex (và question/options nếu cần sửa nội dung câu).
Trả về JSON: {"verified":boolean,"correctIndex":0-3,"question":"...","options":["...","...","...","..."]}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent([prompt, ...imageParts])
  const raw = result.response.text()?.trim() || ''
  return raw ? parseQuizVerify(raw) : null
}

/** Verify bài tự luận bằng Gemini 2.5 Flash + ảnh SGK – khi cần nhìn ảnh. */
export async function verifyEssayWithGeminiVision(
  curriculum: string,
  problem: string,
  solution: string,
  imageParts: Array<{ inlineData: { data: string; mimeType: string } }>
): Promise<{ verified: boolean; problem?: string; solution?: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey || imageParts.length === 0) return null
  const prompt = `Đây là ảnh (các ảnh) trang bài tập SGK. Đối chiếu với đề bài và lời giải đã trích xuất; chấm và sửa theo đúng ảnh + giáo trình.

GIÁO TRÌNH:
---
${curriculum.slice(0, 3000)}
---

ĐỀ BÀI ĐÃ TRÍCH XUẤT:
---
${problem}
---

LỜI GIẢI ĐÃ TRÍCH XUẤT:
---
${solution}
---

Quy tắc chấm (bắt buộc):
- Nếu đề yêu cầu căn cứ đồ thị/hình (vd: "có đồ thị", "Hình", "H.", "theo đồ thị cho ở"...) thì lời giải phải dựa trên QUAN SÁT ĐỒ THỊ trong ảnh: nêu rõ căn cứ từ hình (khoảng tăng/giảm, cực trị nhìn từ đồ thị, điểm đặc biệt trên trục hoặc nét đứt trên hình). CẤM chấp nhận lời giải chỉ lập luận bằng đạo hàm/bảng biến thiên mà không căn cứ đồ thị như SGK yêu cầu — đó là verified:false.
- Nếu đề không gợi ý đọc hình thì có thể chấp nhận giải tích chuẩn (vẫn phải đúng với ảnh nếu ảnh có liên quan).
- verified:true chỉ khi đề và lời giải khớp SGK + ảnh.
- verified:false thì BẮT BUỘC trả về solution đã sửa (và problem nếu cần); lời giải mới phải đúng phương pháp: đọc từ đồ thị khi đề yêu cầu.

Trả về JSON: {"verified":boolean,"problem":"...","solution":"..."}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const result = await model.generateContent([prompt, ...imageParts])
  const raw = result.response.text()?.trim() || ''
  return raw ? parseEssayVerify(raw) : null
}
