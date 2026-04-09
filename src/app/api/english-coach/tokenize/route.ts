import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchCoachMessageTokensByIdPg,
  fetchTeacherMessagesWithTokensPg,
  fetchTokenizationExactPg,
  fetchTokenizationsForUserTargetPg,
  upsertTokenizationPg,
} from '@/lib/db/language-coach-transliteration-tokenize-pg'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  trackEnglishCoachGeminiResult,
  type EnglishCoachUsageContext,
} from '@/lib/english-coach-api-usage'
import { getUserForAction } from '@/lib/auth'
type TokenizePayload = {
  sentence?: string
  targetLanguage?: string
  targetLanguageCode?: string
  messageId?: string
  coachUsageContext?: 'live' | 'preset'
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(s: string): boolean {
  return UUID_REGEX.test(String(s || '').trim())
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
    const rawToken = typeof item === 'object' && item !== null && 'word' in item
      ? String((item as { word?: unknown }).word || '')
      : String(item || '')
    const token = rawToken
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
    if (out.length >= 60) break
  }
  return out
}

type TokenWithUsage = { word: string; usageLevel: 'high' | 'medium' | 'low' }

function normalizeUsageLevel(input: unknown): 'high' | 'medium' | 'low' {
  const s = String(input || '').trim().toLowerCase()
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

function sanitizeTokensWithUsage(raw: unknown, targetLanguageCode: string): TokenWithUsage[] {
  if (!Array.isArray(raw)) return []
  const out: TokenWithUsage[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const rawToken = typeof item === 'object' && item !== null && 'word' in item
      ? String((item as { word?: unknown }).word || '')
      : String(item || '')
    const token = rawToken
      .replace(/^[\s"'""''.,;:!?()\[\]{}<>|\\/`~@#$%^&*_+=-]+/g, '')
      .replace(/[\s"'""''.,;:!?()\[\]{}<>|\\/`~@#$%^&*_+=-]+$/g, '')
      .trim()
    if (!token || seen.has(token)) continue
    if (/[\n\r\t]/.test(token)) continue
    if (/[，。！？；：]/u.test(token)) continue
    if (!keepTokenByTargetLanguage(token, targetLanguageCode)) continue

    const hasCjkThai = /[\u4E00-\u9FFF\u3040-\u30FF\u0E00-\u0E7F]/u.test(token)
    const words = token.split(/\s+/).filter(Boolean)
    if (hasCjkThai) {
      if (token.length > 8) continue
    } else {
      if (words.length > 3) continue
      if (token.length > 24) continue
    }

    seen.add(token)
    const usageLevel = typeof item === 'object' && item !== null && 'usageLevel' in item
      ? normalizeUsageLevel((item as { usageLevel?: unknown }).usageLevel)
      : 'medium'
    out.push({ word: token, usageLevel })
    if (out.length >= 60) break
  }
  return out
}

/** Normalize sentence for flexible matching: trim, collapse whitespace */
function normalizeForMatch(s: string): string {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as TokenizePayload
    const coachCtx: EnglishCoachUsageContext =
      payload.coachUsageContext === 'preset' ? 'preset' : payload.coachUsageContext === 'live' ? 'live' : 'unsessioned'
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

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const messageId = String(payload.messageId || '').trim()

    // 0) Nếu có messageId (UUID của đoạn hỏi đáp) → lấy tokens_json trực tiếp từ message
    if (messageId && isUuid(messageId)) {
      const msgRow = await fetchCoachMessageTokensByIdPg(user.id, messageId)

      if (msgRow?.tokens_json) {
        try {
          const targetLang = String(msgRow.target_language || targetLanguage).trim()
          const langCode = resolveTargetLanguageCode(
            String(payload.targetLanguageCode || ''),
            targetLang || targetLanguage
          )
          const parsed = JSON.parse(msgRow.tokens_json) as unknown
          const withUsage = sanitizeTokensWithUsage(parsed, langCode)
          if (withUsage.length > 0) {
            console.log('[tokenize] DB_HIT_MESSAGE_ID: lấy tokens theo id message', {
              messageId: messageId.slice(0, 8),
              tokenCount: withUsage.length,
            })
            return NextResponse.json({
              tokens: withUsage.map((t) => t.word),
              tokensWithUsage: withUsage,
              cached: true,
            })
          }
          const tokens = sanitizeTokens(parsed, langCode)
          if (tokens.length > 0) {
            console.log('[tokenize] DB_HIT_MESSAGE_ID: lấy tokens theo id (fallback parse)', {
              messageId: messageId.slice(0, 8),
              tokenCount: tokens.length,
            })
            return NextResponse.json({
              tokens,
              tokensWithUsage: tokens.map((w) => ({ word: w, usageLevel: 'medium' as const })),
              cached: true,
            })
          }
        } catch {
          // fall through
        }
      }
    }

    const normSentence = normalizeForMatch(sentence)

    // 1) Check language_coach_tokenizations (exact + normalized match)
    const cachedExact = await fetchTokenizationExactPg(user.id, targetLanguage, sentence)

    let cached: { tokens_json: string } | null = cachedExact
    if (!cached?.tokens_json) {
      const tokenRows = await fetchTokenizationsForUserTargetPg(user.id, targetLanguage, 500)
      if (tokenRows === null) {
        return NextResponse.json({ error: 'Không đọc được cache tokenization.' }, { status: 500 })
      }
      const matchedToken = tokenRows.find((r) => normalizeForMatch(String(r.sentence || '')) === normSentence)
      if (matchedToken?.tokens_json) cached = { tokens_json: matchedToken.tokens_json }
    }

    if (cached?.tokens_json) {
      try {
        const parsed = JSON.parse(cached.tokens_json) as unknown
        const withUsage = sanitizeTokensWithUsage(parsed, targetLanguageCode)
        if (withUsage.length > 0) {
          console.log('[tokenize] DB_HIT: cache hit, returning from language_coach_tokenizations', {
            sentenceLen: sentence.length,
            tokenCount: withUsage.length,
          })
          return NextResponse.json({
            tokens: withUsage.map((t) => t.word),
            tokensWithUsage: withUsage,
            cached: true,
          })
        }
        const tokens = sanitizeTokens(parsed, targetLanguageCode)
        if (tokens.length > 0) {
          console.log('[tokenize] DB_HIT: cache hit (fallback parse), returning from language_coach_tokenizations', {
            sentenceLen: sentence.length,
            tokenCount: tokens.length,
          })
          return NextResponse.json({
            tokens,
            tokensWithUsage: tokens.map((w) => ({ word: w, usageLevel: 'medium' as const })),
            cached: true,
          })
        }
      } catch {
        console.log('[tokenize] DB_HIT_PARSE_FAIL: cached tokens_json invalid, falling through to AI')
        // fallback to AI below
      }
    }

    // 2) Fallback: check language_coach_messages (main_sentence, intent_answer, text) - reuse tokens_json đã có
    // Chạy khi tokenizations miss HOẶC parse lỗi
    {
      const msgRows = await fetchTeacherMessagesWithTokensPg(
        user.id,
        targetLanguage || null,
        200
      )
      if (msgRows === null) {
        return NextResponse.json({ error: 'Không đọc được tin nhắn coach.' }, { status: 500 })
      }

      const matched = msgRows.find((r) => {
            const main = String(r.main_sentence || '').trim()
            const intent = String(r.intent_answer || '').trim()
            const text = String(r.text || '').trim()
            const combined = [main, intent].filter(Boolean).join('\n')
            const combinedAlt = [main, intent].filter(Boolean).join(' ')
            return (
              normSentence === normalizeForMatch(main) ||
              normSentence === normalizeForMatch(intent) ||
              normSentence === normalizeForMatch(text) ||
              normSentence === normalizeForMatch(combined) ||
              normSentence === normalizeForMatch(combinedAlt)
            )
          })

      if (matched?.tokens_json) {
        try {
          const parsed = JSON.parse(matched.tokens_json) as unknown
          const withUsage = sanitizeTokensWithUsage(parsed, targetLanguageCode)
          if (withUsage.length > 0) {
            console.log('[tokenize] DB_HIT_MESSAGES: reused tokens from language_coach_messages', {
              sentenceLen: sentence.length,
              tokenCount: withUsage.length,
            })
            // Backfill tokenizations for next time
            const up1 = await upsertTokenizationPg({
              userId: user.id,
              targetLanguage,
              sentence,
              tokensJson: JSON.stringify(withUsage),
              updatedAtIso: new Date().toISOString(),
            })
            if (!up1.ok) {
              return NextResponse.json({ error: up1.message || 'Không lưu được tokenization.' }, { status: 500 })
            }
            return NextResponse.json({
              tokens: withUsage.map((t) => t.word),
              tokensWithUsage: withUsage,
              cached: true,
            })
          }
          const tokens = sanitizeTokens(parsed, targetLanguageCode)
          if (tokens.length > 0) {
            const fallbackWithUsage = tokens.map((w) => ({ word: w, usageLevel: 'medium' as const }))
            console.log('[tokenize] DB_HIT_MESSAGES: reused tokens (fallback parse)', {
              sentenceLen: sentence.length,
              tokenCount: tokens.length,
            })
            const up2 = await upsertTokenizationPg({
              userId: user.id,
              targetLanguage,
              sentence,
              tokensJson: JSON.stringify(fallbackWithUsage),
              updatedAtIso: new Date().toISOString(),
            })
            if (!up2.ok) {
              return NextResponse.json({ error: up2.message || 'Không lưu được tokenization.' }, { status: 500 })
            }
            return NextResponse.json({
              tokens,
              tokensWithUsage: fallbackWithUsage,
              cached: true,
            })
          }
        } catch {
          // ignore parse error, fall through to AI
        }
      }
    }

    console.log('[tokenize] DB_MISS: no cache (tokenizations + messages), calling AI', {
      sentenceLen: sentence.length,
      targetLanguage,
    })

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
6) Tối đa 60 token (đủ để hiển thị tất cả từ trong Ý 2 và Ý 3).
7) Với mỗi token, gán usageLevel: "high" (dùng rất nhiều trong giao tiếp), "medium" (dùng vừa), "low" (ít dùng).
8) Trả về JSON hợp lệ, không markdown:
{"tokens":[{"word":"...", "usageLevel":"high|medium|low"}, ...]}

Câu:
${sentence}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
    const result = await model.generateContent(prompt)
    trackEnglishCoachGeminiResult(result, GEMINI_25_FLASH_NO_THINKING.model, EnglishCoachApiFeature.tokenize, user.id, coachCtx)
    const text = result.response.text()?.trim() || ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned) as { tokens?: unknown }
      const withUsage = sanitizeTokensWithUsage(parsed.tokens, targetLanguageCode)
      if (withUsage.length > 0) {
        const up3 = await upsertTokenizationPg({
          userId: user.id,
          targetLanguage,
          sentence,
          tokensJson: JSON.stringify(withUsage),
          updatedAtIso: new Date().toISOString(),
        })
        if (!up3.ok) {
          return NextResponse.json({ error: up3.message || 'Không lưu được tokenization.' }, { status: 500 })
        }
        console.log('[tokenize] AI_SUCCESS: Gemini returned tokens, saved to DB', {
          sentenceLen: sentence.length,
          tokenCount: withUsage.length,
        })
        return NextResponse.json({
          tokens: withUsage.map((t) => t.word),
          tokensWithUsage: withUsage,
          cached: false,
        })
      }
      const tokens = sanitizeTokens(parsed.tokens, targetLanguageCode)
      if (tokens.length > 0) {
        const fallbackWithUsage = tokens.map((w) => ({ word: w, usageLevel: 'medium' as const }))
        const up4 = await upsertTokenizationPg({
          userId: user.id,
          targetLanguage,
          sentence,
          tokensJson: JSON.stringify(fallbackWithUsage),
          updatedAtIso: new Date().toISOString(),
        })
        if (!up4.ok) {
          return NextResponse.json({ error: up4.message || 'Không lưu được tokenization.' }, { status: 500 })
        }
        console.log('[tokenize] AI_SUCCESS: Gemini returned (fallback parse), saved to DB', {
          sentenceLen: sentence.length,
          tokenCount: tokens.length,
        })
        return NextResponse.json({
          tokens,
          tokensWithUsage: fallbackWithUsage,
          cached: false,
        })
      }
    } catch (e) {
      console.log('[tokenize] AI_PARSE_FAIL: Gemini response invalid, using fallback', {
        error: e instanceof Error ? e.message : String(e),
      })
      // fallback below
    }

    const fallbackTokens = sanitizeTokens([sentence], targetLanguageCode)
    const fallbackWithUsage = fallbackTokens.map((w) => ({ word: w, usageLevel: 'medium' as const }))
    console.log('[tokenize] AI_FALLBACK: using basic tokenize (no AI)', {
      sentenceLen: sentence.length,
      tokenCount: fallbackTokens.length,
    })
    return NextResponse.json({
      tokens: fallbackTokens,
      tokensWithUsage: fallbackWithUsage,
      cached: false,
      targetLanguageCode,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

