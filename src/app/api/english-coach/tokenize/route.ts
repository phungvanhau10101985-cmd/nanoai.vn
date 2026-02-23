import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type TokenizePayload = {
  sentence?: string
  targetLanguage?: string
  targetLanguageCode?: string
}

function extractTargetSentenceForTokenization(text: string): string {
  const stripTrailingBilingualSections = (input: string) => {
    const markers = [
      'Dịch nhanh',
      'Giải thích',
      'Câu tự nhiên',
      'Câu chuẩn',
      'Câu hoàn chỉnh',
      'Natural sentence',
      'Correct sentence',
      'Quick translation',
      'Explanation',
      'Translation',
    ]
    let out = input.trim()
    for (const marker of markers) {
      const idx = out.toLowerCase().indexOf(marker.toLowerCase())
      if (idx > 0) {
        out = out.slice(0, idx).trim()
      }
    }
    return out.replace(/[\s:：-]+$/g, '').trim()
  }

  const patterns = [
    /Câu hoàn chỉnh\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu tự nhiên\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu chuẩn\s*\([^)]+\)\s*[:：]?\s*\**\s*([^\n]+)/i,
    /Câu (hoàn chỉnh|tự nhiên|chuẩn)\s*(là)?\s*[:：]\s*([^\n]+)/i,
    /(Natural sentence|Correct sentence)\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = stripTrailingBilingualSections(
      String(match?.[3] || match?.[2] || match?.[1] || '')
    )
      .replace(/^\*+|\*+$/g, '')
      .trim()
    if (candidate) return candidate
  }
  return ''
}

function resolveTargetLanguageCode(rawCode: string, rawTargetLanguage: string): string {
  const code = rawCode.trim().toLowerCase()
  if (code) return code
  const label = rawTargetLanguage.trim().toLowerCase()
  if (label.includes('english')) return 'en'
  if (label.includes('chinese') || label.includes('mandarin')) return 'zh'
  if (label.includes('japanese')) return 'ja'
  if (label.includes('korean')) return 'ko'
  if (label.includes('thai')) return 'th'
  if (label.includes('hindi')) return 'hi'
  if (label.includes('vietnamese')) return 'vi'
  return ''
}

function keepTokenByTargetLanguage(token: string, targetLanguageCode: string): boolean {
  const code = targetLanguageCode.toLowerCase()
  if (!code) return true
  if (code === 'en') return /^[A-Za-z][A-Za-z'’-]*$/.test(token)
  if (code === 'vi') return /[a-zA-Z\u00C0-\u024F]/u.test(token)
  if (code === 'zh') return /[\u4E00-\u9FFF]/u.test(token)
  if (code === 'ja') return /[\u3040-\u30FF\u4E00-\u9FFF]/u.test(token)
  if (code === 'ko') return /[\uAC00-\uD7AF]/u.test(token)
  if (code === 'th') return /[\u0E00-\u0E7F]/u.test(token)
  if (code === 'hi') return /[\u0900-\u097F]/u.test(token)
  // Latin-based targets (en/vi/etc.)
  return /[a-zA-Z\u00C0-\u024F]/u.test(token)
}

function sanitizeTokens(raw: unknown, targetLanguageCode: string): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const token = String(item || '')
      .replace(/^[\s"'“”‘’.,;:!?()\[\]{}<>|\\/`~@#$%^&*_+=-]+/g, '')
      .replace(/[\s"'“”‘’.,;:!?()\[\]{}<>|\\/`~@#$%^&*_+=-]+$/g, '')
      .trim()
    if (!token) continue
    if (/[\n\r\t]/.test(token)) continue
    if (/[，。！？；：]/u.test(token)) continue
    if (!keepTokenByTargetLanguage(token, targetLanguageCode)) continue

    const hasCjkThai = /[\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F]/u.test(token)
    const words = token.split(/\s+/).filter(Boolean)
    if (hasCjkThai) {
      // Keep short lexical units for CJK/Thai, avoid full-clause chunks.
      if (token.length > 8) continue
    } else {
      // Keep vocabulary-like units, not long translated phrases.
      if (words.length > 3) continue
      if (token.length > 24) continue
    }

    if (!out.includes(token)) out.push(token)
    if (out.length >= 24) break
  }
  return out
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as TokenizePayload
    const rawSentence = String(payload.sentence || '').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const targetLanguageCode = resolveTargetLanguageCode(
      String(payload.targetLanguageCode || ''),
      targetLanguage
    )
    if (!rawSentence) {
      return NextResponse.json({ error: 'Thiếu câu cần tách từ.' }, { status: 400 })
    }
    // Keep the full teacher reply as tokenization source so we can extract
    // vocabulary from the whole explanation block, not just one labeled sentence.
    const sentence = rawSentence

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tách từ.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { data: cached } = await adminSupabase
      .from('language_coach_tokenizations')
      .select('tokens_json')
      .eq('user_id', user.id)
      .eq('target_language', targetLanguage)
      .eq('sentence', sentence)
      .maybeSingle()

    if (cached?.tokens_json) {
      try {
        const parsed = JSON.parse(cached.tokens_json) as string[]
        const tokens = sanitizeTokens(parsed, targetLanguageCode)
        if (tokens.length > 0) return NextResponse.json({ tokens, cached: true })
      } catch {
        // fallback to AI below
      }
    }

    const strictLanguageInstruction =
      targetLanguageCode === 'en'
        ? 'CHỈ giữ từ tiếng Anh. Loại bỏ hoàn toàn từ tiếng Việt hoặc ngôn ngữ khác.'
        : targetLanguageCode === 'zh'
          ? 'CHỈ giữ từ/cụm tiếng Trung (chữ Hán). Loại bỏ toàn bộ ngôn ngữ khác.'
          : targetLanguageCode === 'ja'
            ? 'CHỈ giữ từ/cụm tiếng Nhật. Loại bỏ toàn bộ ngôn ngữ khác.'
            : targetLanguageCode === 'ko'
              ? 'CHỈ giữ từ/cụm tiếng Hàn. Loại bỏ toàn bộ ngôn ngữ khác.'
              : targetLanguageCode === 'th'
                ? 'CHỈ giữ từ/cụm tiếng Thái. Loại bỏ toàn bộ ngôn ngữ khác.'
                : targetLanguageCode === 'hi'
                  ? 'CHỈ giữ từ/cụm tiếng Hindi. Loại bỏ toàn bộ ngôn ngữ khác.'
                  : targetLanguageCode === 'vi'
                    ? 'CHỈ giữ từ/cụm tiếng Việt. Loại bỏ toàn bộ ngôn ngữ khác.'
                    : `CHỈ giữ token thuộc ngôn ngữ mục tiêu ${targetLanguage}.`

    const prompt = `Hãy chỉ tách các từ vựng của ngôn ngữ mục tiêu từ câu sau.
Ngôn ngữ mục tiêu: ${targetLanguage}${targetLanguageCode ? ` (${targetLanguageCode})` : ''}.
${strictLanguageInstruction}

Yêu cầu:
1) Trả token dạng "từ mới để học", KHÔNG trả cả cụm câu dài.
2) CHỈ giữ token thuộc ngôn ngữ mục tiêu (${targetLanguage}${targetLanguageCode ? ` - code: ${targetLanguageCode}` : ''}).
   Bỏ hoàn toàn token của ngôn ngữ mẹ đẻ/ngoại ngữ khác trong câu trộn.
3) Với tiếng có khoảng trắng: mỗi token tối đa 1-3 từ.
4) Với Chinese/Japanese/Thai: tách đúng ranh giới từ tự nhiên, mỗi token ngắn (thường 1-4 ký tự, tối đa 8).
5) Không trả dấu câu, không trả cụm dịch nghĩa, không trả đoạn giải thích.
6) Tối đa 24 token.
7) Trả về JSON hợp lệ, không markdown:
{"tokens":["...", "..."]}

Câu:
${sentence}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() || ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned) as { tokens?: unknown }
      const tokens = sanitizeTokens(parsed.tokens, targetLanguageCode)
      if (tokens.length > 0) {
        await adminSupabase.from('language_coach_tokenizations').upsert(
          {
            user_id: user.id,
            target_language: targetLanguage,
            sentence,
            tokens_json: JSON.stringify(tokens),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,target_language,sentence' }
        )
        return NextResponse.json({ tokens, cached: false })
      }
    } catch {
      // fallback below
    }

    const fallbackTokens = sanitizeTokens([sentence], targetLanguageCode)
    return NextResponse.json({ tokens: fallbackTokens, cached: false, targetLanguageCode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

