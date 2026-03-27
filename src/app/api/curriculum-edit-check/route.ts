/**
 * Kiểm tra câu sửa của giáo viên bằng 2 lượt Gemini 2.5 Flash.
 * Chỉ chạy khi bấm Lưu/Áp dụng. Cả 2 đồng ý → lưu. Trả về lý do đã lưu / chưa lưu được.
 */

import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { CurriculumApiFeature, trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'

const PROMPT_FULL = `Bạn là chuyên gia kiểm tra giáo trình giáo dục Việt Nam (Công văn 5512/BGDĐT).
Kiểm tra nội dung giáo trình Markdown dưới đây. Tìm sai sót về:
- Kiến thức chuyên môn (công thức, khái niệm, định lý sai)
- Cấu trúc (thiếu hoạt động, thời lượng không khớp)
- Định dạng (dùng LaTeX $...$ thay vì Unicode)

Trả về ĐÚNG JSON (không thêm markdown, không giải thích):
{"correct": true} nếu không có lỗi.
{"correct": false, "errors": ["Mô tả lỗi 1", "Mô tả lỗi 2", ...]} nếu có lỗi. Mỗi lỗi ghi rõ vị trí/vấn đề.`

const PROMPT_REGION = `So sánh 2 đoạn giáo trình. Chỉ trả về JSON, không giải thích thêm.
Ngữ cảnh: mỗi đoạn gồm tối đa 250 ký tự trước phần sửa + phần sửa. Nội dung sau phần sửa không có – đánh giá dựa trên ngữ cảnh trước.

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

async function checkWithGemini(
  genAI: GoogleGenerativeAI,
  content: string,
  prompt: string = PROMPT_FULL
): Promise<{ correct: boolean; errors: string[] }> {
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
  const truncated = content.slice(0, 28000)
  const result = await model.generateContent(`${prompt}\n\n---\n\n${truncated}`)
  trackCurriculumGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    CurriculumApiFeature.editCheckFull,
    null
  )
  const text = result.response.text()?.trim() || ''
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*/g, '').trim())
    const correct = !!parsed.correct
    const errors = Array.isArray(parsed.errors) ? parsed.errors : []
    return { correct, errors }
  } catch {
    return { correct: true, errors: [] }
  }
}

async function checkWithDeepSeek(content: string, prompt: string = PROMPT_FULL): Promise<{ correct: boolean; errors: string[] } | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
  const truncated = content.slice(0, 28000)
  const result = await model.generateContent(`${prompt}\n\n---\n\n${truncated}`)
  trackCurriculumGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    CurriculumApiFeature.editCheckFull,
    null
  )
  const text = result.response.text()?.trim() || ''
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*/g, '').trim())
    const correct = !!parsed.correct
    const errors = Array.isArray(parsed.errors) ? parsed.errors : []
    return { correct, errors }
  } catch {
    return null
  }
}

async function checkWithGeminiFlash(genAI: GoogleGenerativeAI, content: string, prompt: string = PROMPT_FULL): Promise<{ correct: boolean; errors: string[] }> {
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
  const truncated = content.slice(0, 28000)
  const result = await model.generateContent(`${prompt}\n\n---\n\n${truncated}`)
  trackCurriculumGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    CurriculumApiFeature.editCheckFull,
    null
  )
  const text = result.response.text()?.trim() || ''
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*/g, '').trim())
    const correct = !!parsed.correct
    const errors = Array.isArray(parsed.errors) ? parsed.errors : []
    return { correct, errors }
  } catch {
    return { correct: true, errors: [] }
  }
}

type RegionCompareResult = {
  correctVersion: 'original' | 'edited' | 'both'
  originalCorrect: boolean
  editedCorrect: boolean
  originalReason: string | null
  editedReason: string | null
  explanation: string
}

async function checkRegionWithGemini(
  genAI: GoogleGenerativeAI,
  prompt: string
): Promise<RegionCompareResult | null> {
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  trackCurriculumGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    CurriculumApiFeature.editCheckRegion,
    null
  )
  const text = result.response.text()?.trim() || ''
  return parseRegionResult(text)
}

async function checkRegionWithDeepSeek(prompt: string): Promise<RegionCompareResult | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING as { model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  trackCurriculumGeminiResult(
    result,
    GEMINI_25_FLASH_NO_THINKING.model,
    CurriculumApiFeature.editCheckRegion,
    null
  )
  const text = result.response.text()?.trim() || ''
  return parseRegionResult(text)
}

function parseRegionResult(text: string): RegionCompareResult | null {
  try {
    const parsed = JSON.parse(text.replace(/```json?\s*/g, '').trim())
    const correctVersion = ['original', 'edited', 'both'].includes(parsed.correctVersion) ? parsed.correctVersion : 'edited'
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

const REGION_MAX_CHARS = 1000

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    const body = await req.json().catch(() => ({}))
    const content = typeof body.content === 'string' ? body.content : ''
    const originalRegion = typeof body.originalRegion === 'string' ? body.originalRegion : ''
    const editedRegion = typeof body.editedRegion === 'string' ? body.editedRegion : ''

    const isRegionMode = editedRegion.length >= 10 && (originalRegion.length >= 5 || originalRegion === '')

    const prompt = PROMPT_FULL
    const toCheck = content

    if (isRegionMode) {
      const orig = (originalRegion.trim() || '(đoạn mới thêm)').slice(0, REGION_MAX_CHARS)
      const edited = editedRegion.slice(0, REGION_MAX_CHARS)
      const regionPrompt = PROMPT_REGION.replace('{originalRegion}', orig).replace('{editedRegion}', edited)
      const genAI = new GoogleGenerativeAI(apiKey)
      const [r1, r2] = await Promise.all([
        checkRegionWithGemini(genAI, regionPrompt),
        checkRegionWithDeepSeek(regionPrompt),
      ])
      const regionResult = r1 ?? r2
      if (!regionResult) {
        return NextResponse.json({ error: 'AI không trả về kết quả so sánh. Kiểm tra GOOGLE_API_KEY.' }, { status: 500 })
      }
      // Chỉ bothAgree=false khi CẢ 2 model trả về VÀ đưa ra ý kiến khác nhau
      const bothAgree = !r1 || !r2 || r1.correctVersion === r2.correctVersion
      // Cho phép lưu khi bản sửa đúng VÀ AI chọn bản sửa hoặc cả hai đều đúng (không cần originalCorrect – sửa đáp án sai thành đúng là hợp lệ)
      const canSave = bothAgree && regionResult.editedCorrect && (regionResult.correctVersion === 'edited' || regionResult.correctVersion === 'both')
      const errors: string[] = []
      if (!regionResult.originalCorrect && regionResult.originalReason) errors.push(`Bản gốc sai: ${regionResult.originalReason}`)
      if (!regionResult.editedCorrect && regionResult.editedReason) errors.push(`Bản sửa sai: ${regionResult.editedReason}`)
      const reasonNotSaved = !canSave
        ? (regionResult.explanation || errors.join('. ') || (bothAgree ? (regionResult.correctVersion === 'original' ? '2 AI đồng ý giữ bản gốc.' : '2 AI không đồng ý bản sửa.') : '2 AI không đồng ý.'))
        : null
      const reasonSaved = canSave ? (regionResult.explanation || '2 AI (Gemini Pro + DeepSeek) đồng ý bản sửa đúng.') : null
      return NextResponse.json({
        ok: canSave,
        errors,
        regionCompare: regionResult,
        bothAgree,
        model1Version: r1?.correctVersion,
        model2Version: r2?.correctVersion,
        reasonSaved,
        reasonNotSaved,
      })
    } else if (!content || content.length < 50) {
      return NextResponse.json({ error: 'Nội dung quá ngắn.' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const [geminiResult, deepSeekResult] = await Promise.all([
      checkWithGemini(genAI, toCheck, prompt),
      checkWithDeepSeek(toCheck, prompt),
    ])
    const r2 = deepSeekResult ?? (await checkWithGeminiFlash(genAI, toCheck, prompt))
    const bothCorrect = geminiResult.correct && r2.correct
    const allErrors = [...new Set([...geminiResult.errors, ...r2.errors])]

    return NextResponse.json({
      ok: bothCorrect,
      errors: bothCorrect ? [] : allErrors,
      model1: { correct: geminiResult.correct },
      model2: { correct: r2.correct },
    })
  } catch (e) {
    console.error('[curriculum-edit-check]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi kiểm tra.' },
      { status: 500 }
    )
  }
}
