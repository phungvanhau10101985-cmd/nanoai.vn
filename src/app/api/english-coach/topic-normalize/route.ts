import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  deleteCustomTopicsByNormalizedTopicIdPg,
  listSharedCustomTopicsPg,
  upsertSharedCustomTopicPg,
} from '@/lib/db/language-coach-topics-pg'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  EnglishCoachApiFeature,
  parseCoachUsageContextPayload,
  trackEnglishCoachGeminiResult,
} from '@/lib/english-coach-api-usage'
import { getUserForAction } from '@/lib/auth'
type Payload = {
  rawTopic?: string
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: 0 | 1 | 2 | 3 | 4
  coachUsageContext?: 'live' | 'preset'
}

function tr(input: string): 'vi' | 'en' {
  const value = String(input || '').toLowerCase()
  return value.includes('vietnamese') ? 'vi' : 'en'
}

function msg(locale: 'vi' | 'en', vi: string, en: string): string {
  return locale === 'vi' ? vi : en
}

type NormalizedTopic = {
  topicId: string
  topicLabel: string
  topicDifficulty: 'basic' | 'intermediate' | 'advanced'
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function toTopicId(input: string): string {
  const ascii = String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return (ascii || 'custom-topic').slice(0, 80)
}

function normalizeLabel(input: string): string {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-(),./:&]/gu, '')
    .trim()
}

function looksMeaningfulTopic(text: string): boolean {
  const t = normalizeLabel(text)
  if (t.length < 8 || t.length > 90) return false
  const letterCount = (t.match(/\p{L}/gu) || []).length
  if (letterCount < 6) return false
  const distinctChars = new Set(t.toLowerCase().replace(/\s+/g, '')).size
  if (distinctChars < 4) return false
  if (/(.)\1{4,}/u.test(t)) return false
  if (/^[\d\W_]+$/u.test(t)) return false
  return true
}

function safeParse(text: string): NormalizedTopic | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<NormalizedTopic>
    const topicId = toTopicId(String(parsed.topicId || '').trim())
    const topicLabel = normalizeLabel(String(parsed.topicLabel || '')).slice(0, 120)
    const topicDifficulty =
      parsed.topicDifficulty === 'advanced'
        ? 'advanced'
        : parsed.topicDifficulty === 'intermediate'
          ? 'intermediate'
          : 'basic'
    if (!topicId || !topicLabel || !looksMeaningfulTopic(topicLabel)) return null
    return { topicId, topicLabel, topicDifficulty }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const locale = tr(request.nextUrl.searchParams.get('nativeLanguage') || '')
    const auth = await getUserForAction(
      msg(locale, 'Vui lòng đăng nhập để xem chủ đề tự tạo.', 'Please sign in to view custom topics.')
    )
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const targetLanguage = normalizeLookup(request.nextUrl.searchParams.get('targetLanguage') || '')
    const nativeLanguage = normalizeLookup(request.nextUrl.searchParams.get('nativeLanguage') || '')
    const learnerLevelRaw = Number(request.nextUrl.searchParams.get('learnerLevel') || 0)
    const learnerLevel =
      learnerLevelRaw === 4 ? 4 : learnerLevelRaw === 3 ? 3 : learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20

    const data = await listSharedCustomTopicsPg({
      normalizedTargetLanguage: targetLanguage,
      normalizedNativeLanguage: nativeLanguage,
      learnerLevel,
      limit,
    })
    if (data === null) {
      return NextResponse.json(
        { error: msg(locale, 'Không tải được chủ đề tự tạo.', 'Failed to load custom topics.') },
        { status: 500 }
      )
    }

    return NextResponse.json({
      items: data.map((x) => ({
        topicId: String(x.topic_id || '').trim(),
        topicLabel: String(x.topic_label || '').trim(),
        topicDifficulty:
          x.topic_difficulty === 'advanced'
            ? 'advanced'
            : x.topic_difficulty === 'intermediate'
              ? 'intermediate'
              : 'basic',
        targetLanguage: String(x.target_language || '').trim(),
        nativeLanguage: String(x.native_language || '').trim(),
        learnerLevel: Number(x.learner_level || 0),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const payload = (await request.json()) as Payload
    const coachCtx = parseCoachUsageContextPayload(payload.coachUsageContext)
    const locale = tr(payload.nativeLanguage || '')
    const auth = await getUserForAction(
      msg(locale, 'Vui lòng đăng nhập để tạo chủ đề.', 'Please sign in to create a topic.')
    )
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const rawTopic = String(payload.rawTopic || '').trim()
    if (!rawTopic) return NextResponse.json({ error: msg(locale, 'Vui lòng nhập chủ đề muốn học.', 'Please enter a topic to learn.') }, { status: 400 })
    if (!looksMeaningfulTopic(rawTopic)) {
      return NextResponse.json(
        {
          error: msg(
            locale,
            'Chủ đề chưa rõ hoặc quá ngắn. Hãy nhập chủ đề có ý nghĩa, ví dụ: "Phỏng vấn xin việc ngành IT".',
            'The topic is unclear or too short. Please enter a meaningful topic, e.g. "IT job interview".'
          ),
        },
        { status: 400 }
      )
    }
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const learnerLevelRaw = Number(payload.learnerLevel)
    const learnerLevel: 0 | 1 | 2 | 3 | 4 =
      learnerLevelRaw === 4 ? 4 : learnerLevelRaw === 3 ? 3 : learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: msg(locale, 'Thiếu GOOGLE_API_KEY.', 'Missing GOOGLE_API_KEY.') }, { status: 500 })
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)

    const prompt = `Bạn là chuyên gia chuẩn hóa chủ đề học ngoại ngữ.
Chuẩn hóa chủ đề học sinh tự nhập thành JSON ngắn gọn để lưu DB.

Input:
- rawTopic: ${rawTopic}
- targetLanguage: ${targetLanguage}
- nativeLanguage: ${nativeLanguage}
- learnerLevel: ${learnerLevel}

Yêu cầu:
1) topicId: dạng slug tiếng Anh (a-z, 0-9, dấu -), ngắn gọn, không trùng ý.
2) topicLabel: nhãn tiếng Việt rõ ràng, thân thiện để hiển thị trong dropdown, dài 12-70 ký tự.
3) topicDifficulty: chỉ một trong basic/intermediate/advanced, bám learnerLevel:
   - level 0-1 ưu tiên basic
   - level 2 ưu tiên basic hoặc intermediate
   - level 3 ưu tiên intermediate hoặc advanced
   - level 4 ưu tiên advanced
4) Không dùng nhãn vô nghĩa, ký tự loạn, hoặc nhãn quá ngắn như "abc", "kkk", "123".

Trả về đúng JSON:
{
  "topicId": "string",
  "topicLabel": "string",
  "topicDifficulty": "basic|intermediate|advanced"
}`

    const result = await model.generateContent(prompt)
    trackEnglishCoachGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      EnglishCoachApiFeature.topicNormalize,
      user.id,
      coachCtx
    )
    const normalized = safeParse(result.response.text?.() || '')
    const fallbackLabel = normalizeLabel(rawTopic).slice(0, 120)
    const fallback: NormalizedTopic | null = looksMeaningfulTopic(fallbackLabel)
      ? {
          topicId: toTopicId(rawTopic),
          topicLabel: fallbackLabel,
          topicDifficulty:
            learnerLevel <= 1
              ? 'basic'
              : learnerLevel === 2
                ? 'intermediate'
                : 'advanced',
        }
      : null
    const finalTopic = normalized || fallback
    if (!finalTopic) {
      return NextResponse.json(
        {
          error: msg(
            locale,
            'Chủ đề chưa đủ rõ để chuẩn hóa. Hãy nhập cụ thể hơn (mục tiêu + ngữ cảnh).',
            'The topic is not specific enough to normalize. Please be more specific (goal + context).'
          ),
        },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const data = await upsertSharedCustomTopicPg({
      userId: user.id,
      rawTopic,
      topicId: finalTopic.topicId,
      topicLabel: finalTopic.topicLabel,
      topicDifficulty: finalTopic.topicDifficulty,
      targetLanguage,
      nativeLanguage,
      learnerLevel,
      normalizedTopicId: normalizeLookup(finalTopic.topicId),
      normalizedTargetLanguage: normalizeLookup(targetLanguage),
      normalizedNativeLanguage: normalizeLookup(nativeLanguage),
      nowIso: now,
    })

    if (!data) {
      return NextResponse.json(
        { error: msg(locale, 'Không lưu được chủ đề tự tạo.', 'Failed to save custom topic.') },
        { status: 500 }
      )
    }

    return NextResponse.json({
      topicId: String(data.topic_id || '').trim(),
      topicLabel: String(data.topic_label || '').trim(),
      topicDifficulty:
        data.topic_difficulty === 'advanced'
          ? 'advanced'
          : data.topic_difficulty === 'intermediate'
            ? 'intermediate'
            : 'basic',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const payload = (await request.json()) as { topicId?: string; nativeLanguage?: string }
    const locale = tr(payload.nativeLanguage || '')
    const auth = await getUserForAction(
      msg(locale, 'Vui lòng đăng nhập để xóa chủ đề.', 'Please sign in to delete a topic.')
    )
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const profile = await pgQueryOne<{ role: unknown }>(
      'select role from public.profiles where id = $1::uuid limit 1',
      [user.id]
    )
    if (!profile) {
      return NextResponse.json(
        { error: msg(locale, 'Không kiểm tra được quyền quản trị.', 'Unable to verify admin permission.') },
        { status: 500 }
      )
    }
    if (String(profile.role || '') !== 'admin') {
      return NextResponse.json({ error: msg(locale, 'Chỉ quản trị viên mới có quyền xóa chủ đề.', 'Only admins can delete topics.') }, { status: 403 })
    }

    const topicId = String(payload.topicId || '').trim()
    if (!topicId) return NextResponse.json({ error: msg(locale, 'Thiếu topicId cần xóa.', 'Missing topicId to delete.') }, { status: 400 })

    const del = await deleteCustomTopicsByNormalizedTopicIdPg(normalizeLookup(topicId))
    if (!del.ok) {
      return NextResponse.json(
        { error: del.message || msg(locale, 'Không xóa được chủ đề.', 'Failed to delete topic.') },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
