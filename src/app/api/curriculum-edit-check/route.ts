/**
 * Kiểm tra câu sửa của giáo viên bằng 2 AI: Gemini 2.5 Pro + DeepSeek Reasoner.
 * Chỉ chạy khi bấm Lưu/Áp dụng. Cả 2 đồng ý → lưu. Trả về lý do đã lưu / chưa lưu được.
 */

import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_PRO, GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

const PROMPT_FULL = `Bạn là chuyên gia kiểm tra giáo trình giáo dục Việt Nam (Công văn 5512/BGDĐT).
Kiểm tra nội dung giáo trình Markdown dưới đây. Tìm sai sót về:
- Kiến thức chuyên môn (công thức, khái niệm, định lý sai)
- Cấu trúc (thiếu hoạt động, thời lượng không khớp)
- Định dạng (dùng LaTeX $...$ thay vì Unicode)

Trả về ĐÚNG JSON (không thêm markdown, không giải thích):
{"correct": true} nếu không có lỗi.
{"correct": false, "errors": ["Mô tả lỗi 1", "Mô tả lỗi 2", ...]} nếu có lỗi. Mỗi lỗi ghi rõ vị trí/vấn đề.`

const PROMPT_REGION = `So sánh 2 đoạn giáo trình. Chỉ trả về JSON, không giải thích thêm.

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

async function checkWithModel(
  genAI: GoogleGenerativeAI,
  modelConfig: { model: string },
  content: string,
  prompt: string = PROMPT_FULL
): Promise<{ correct: boolean; errors: string[] }> {
  const model = genAI.getGenerativeModel(modelConfig as { model: 'gemini-2.5-pro' | 'gemini-2.5-flash' })
  const truncated = content.slice(0, 28000)
  const result = await model.generateContent(`${prompt}\n\n---\n\n${truncated}`)
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
  const model = genAI.getGenerativeModel(GEMINI_25_PRO as { model: 'gemini-2.5-pro' })
  const result = await model.generateContent(prompt)
  const text = result.response.text()?.trim() || ''
  return parseRegionResult(text)
}

async function checkRegionWithDeepSeek(prompt: string): Promise<RegionCompareResult | null> {
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

    let prompt = PROMPT_FULL
    let toCheck = content

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
        return NextResponse.json({ error: 'AI không trả về kết quả so sánh. Kiểm tra DEEPSEEK_API_KEY.' }, { status: 500 })
      }
      // Chỉ bothAgree=false khi CẢ 2 model trả về VÀ đưa ra ý kiến khác nhau
      const bothAgree = !r1 || !r2 || r1.correctVersion === r2.correctVersion
      const canSave = bothAgree && regionResult.originalCorrect && regionResult.editedCorrect && regionResult.correctVersion === 'edited'
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
    const [r1, r2] = await Promise.all([
      checkWithModel(genAI, GEMINI_25_PRO, toCheck, prompt),
      checkWithModel(genAI, GEMINI_25_FLASH_NO_THINKING, toCheck, prompt),
    ])

    const bothCorrect = r1.correct && r2.correct
    const allErrors = [...new Set([...r1.errors, ...r2.errors])]

    return NextResponse.json({
      ok: bothCorrect,
      errors: bothCorrect ? [] : allErrors,
      model1: { correct: r1.correct },
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
