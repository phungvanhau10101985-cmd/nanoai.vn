import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  fetchSchoolByIdPg,
  findSchoolByNormalizedName,
  insertSchool,
  searchSchoolsForTeacher,
  upsertTeacherDefaultSchool,
} from '@/lib/db/schools-repo'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import {
  cleanSchoolLabel,
  ensureSchoolPrefix,
  filterSchoolSuggestions,
  normalizeSchoolName,
  shouldSuggestMoreSchools,
  toSearchTokens,
} from '@/lib/school-name'
import { trackFromUsageMetadata, trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

function parseSuggestedSchools(raw: string): string[] {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { schools?: unknown }
    if (!Array.isArray(parsed.schools)) return []
    return parsed.schools.map((item) => cleanSchoolLabel(String(item ?? ''))).filter((item) => item.length >= 3)
  } catch {
    return []
  }
}

/** Danh sách còn thiếu thì DeepSeek đề xuất vài tên trường có chứa cụm giáo viên gõ. */
async function suggestSchoolNamesWithDeepseek(
  query: string,
  already: string[],
  userId?: string | null
): Promise<string[]> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return []
  const model = resolveDeepSeekChatModel()
  const known = already.map((name) => name.trim()).filter(Boolean).join('; ')
  const prompt = `Giáo viên đang gõ cụm chữ để tìm trường ở Việt Nam: "${query}"
Đã có trong danh sách: ${known || '(chưa có)'}
Đề xuất đúng 4 tên trường KHÁC những tên đã có. Mỗi tên phải chứa cụm chữ giáo viên gõ (không phân biệt dấu và hoa thường).
Viết hoa tên riêng. Ghi cấp nếu hợp lý: Tiểu học, THCS hoặc THPT.
Trả về một dòng JSON: {"schools":["...","...","...","..."]}
Không giải thích.`
  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody('chat', {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
          temperature: 0.3,
        })
      ),
      signal: AbortSignal.timeout(15000),
    })
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(json.choices?.[0]?.message?.content ?? '')
    trackOpenAiStyleCompletionUsage({
      userId: userId ?? null,
      model,
      feature: 'schools-search-suggest-deepseek',
      usage: json.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    if (!res.ok) return []
    const known = new Set(already.map((name) => normalizeSchoolName(ensureSchoolPrefix(name))))
    return filterSchoolSuggestions(parseSuggestedSchools(text), query, 8).filter((name) => {
      const key = normalizeSchoolName(ensureSchoolPrefix(name))
      return Boolean(key) && !known.has(key)
    }).slice(0, 4)
  } catch {
    return []
  }
}

async function saveSchoolNames(names: string[], userId: string): Promise<void> {
  for (const raw of names) {
    const canonicalName = ensureSchoolPrefix(raw)
    const normalized = normalizeSchoolName(canonicalName)
    if (!normalized) continue
    const existing = await findSchoolByNormalizedName(normalized)
    if (existing?.id) continue
    try {
      await insertSchool({
        name: canonicalName,
        normalizedName: normalized,
        searchTokens: normalized,
        createdBy: userId,
      })
    } catch {
      /* tên vừa được lưu bởi request khác */
    }
  }
}

type SchoolHit = {
  id: string
  name: string
  normalized_name: string
  search_tokens: string
}

async function listMatchingSchools(q: string): Promise<Array<{ id: string; name: string }>> {
  const normalized = normalizeSchoolName(q)
  const queryTokens = toSearchTokens(q)
  const firstToken = queryTokens[0] ?? normalized
  const data = await searchSchoolsForTeacher(q, firstToken)
  const filtered = (data || []).filter((row: SchoolHit) => {
    const rowTokens = new Set(toSearchTokens(String(row.search_tokens || row.normalized_name || row.name || '')))
    return queryTokens.some((token) => rowTokens.has(token))
  })
  return filtered.slice(0, 20).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? '').trim(),
  }))
}

async function canonicalizeSchoolNameByAi(input: string, userId?: string | null): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return null
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
  const prompt = `Chuẩn hoá tên trường học tại Việt Nam từ chuỗi giáo viên nhập.
Trả về đúng JSON một dòng:
{"schoolName":"..."}

Yêu cầu:
- Giữ tên trường tự nhiên, dễ đọc, viết hoa đúng.
- Nếu input không đủ thông tin, vẫn trả về phiên bản sạch nhất có thể.
- Không thêm mô tả, chỉ JSON.

Input: ${input}`
  try {
    const result = await model.generateContent(prompt)
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_25_FLASH_TEXT_NO_THINKING.model,
      'schools-search-canonicalize-gemini-flash',
      userId ?? null,
      null
    )
    const raw = (result.response.text?.() || '').trim()
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim()
    const parsed = JSON.parse(cleaned) as { schoolName?: unknown }
    const label = ensureSchoolPrefix(String(parsed?.schoolName ?? ''))
    if (!label || label.length < 3) return null
    return label
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const q = String(req.nextUrl.searchParams.get('q') ?? '').trim()
  const useAi = String(req.nextUrl.searchParams.get('ai') ?? '').trim() === '1'
  const wantSuggest = String(req.nextUrl.searchParams.get('suggest') ?? '').trim() === '1'
  if (!q) return NextResponse.json({ items: [], suggestions: [], canCreate: false })

  const normalized = normalizeSchoolName(q)
  let items: Array<{ id: string; name: string }>
  try {
    items = await listMatchingSchools(q)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  const existsExact = items.some((x) => normalizeSchoolName(x.name) === normalized)

  let aiSuggestedName: string | null = null
  let aiMatchedExisting: { id: string; name: string } | null = null
  if (useAi && !existsExact && q.length >= 4) {
    aiSuggestedName = await canonicalizeSchoolNameByAi(q, auth.user?.id ?? null)
    if (aiSuggestedName) {
      const aiNorm = normalizeSchoolName(aiSuggestedName)
      const exactByAi = await findSchoolByNormalizedName(aiNorm)
      if (exactByAi?.id) {
        aiMatchedExisting = {
          id: String(exactByAi.id),
          name: String(exactByAi.name ?? '').trim(),
        }
      }
    }
  }

  const mergedItems = aiMatchedExisting
    ? [aiMatchedExisting, ...items.filter((x) => x.id !== aiMatchedExisting?.id)]
    : items

  let listed = mergedItems
  if (wantSuggest && auth.user?.id && shouldSuggestMoreSchools(listed.map((item) => item.name), q)) {
    const names = await suggestSchoolNamesWithDeepseek(q, listed.map((item) => item.name), auth.user.id)
    await saveSchoolNames(names, auth.user.id)
    try {
      const again = await listMatchingSchools(q)
      if (again.length > 0) listed = again
    } catch {
      /* giữ danh sách đã có */
    }
  }

  const listedExact = listed.some((item) => normalizeSchoolName(item.name) === normalized)
  return NextResponse.json({
    items: listed,
    suggestions: [],
    canCreate: normalized.length >= 3 && !listedExact,
    suggestedName: q,
    aiSuggestedName,
    aiMatchedExisting,
  })
}

export async function POST(req: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const { user } = auth

  const body = await req.json().catch(() => ({}))
  const schoolIdBody = String(body?.schoolId ?? '').trim()
  const setAsDefault = Boolean(body?.setAsDefault ?? true)
  if (schoolIdBody) {
    const school = await fetchSchoolByIdPg(schoolIdBody)
    if (!school?.id) return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
    if (setAsDefault) {
      const up = await upsertTeacherDefaultSchool(user.id, school.id)
      if (!up.ok) return NextResponse.json({ error: up.error ?? 'Không lưu trường mặc định.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, schoolId: school.id, canonicalName: school.name })
  }

  const name = String(body?.name ?? '').trim()
  const useAi = Boolean(body?.useAi ?? false)
  if (name.length < 3) {
    return NextResponse.json({ error: 'Tên trường quá ngắn.' }, { status: 400 })
  }

  const canonicalName = ensureSchoolPrefix(useAi ? (await canonicalizeSchoolNameByAi(name, user.id)) || name : name)
  const normalized = normalizeSchoolName(canonicalName)
  if (!normalized) return NextResponse.json({ error: 'Tên trường không hợp lệ.' }, { status: 400 })

  let schoolId = ''
  const existing = await findSchoolByNormalizedName(normalized)
  if (existing?.id) {
    schoolId = String(existing.id)
  } else {
    try {
      const inserted = await insertSchool({
        name: ensureSchoolPrefix(canonicalName),
        normalizedName: normalized,
        searchTokens: normalized,
        createdBy: user.id,
      })
      if (!inserted?.id) {
        return NextResponse.json({ error: 'Không thể tạo trường.' }, { status: 500 })
      }
      schoolId = String(inserted.id)
    } catch {
      const again = await findSchoolByNormalizedName(normalized)
      if (!again?.id) return NextResponse.json({ error: 'Không thể tạo trường.' }, { status: 500 })
      schoolId = String(again.id)
    }
  }

  if (setAsDefault) {
    const up = await upsertTeacherDefaultSchool(user.id, schoolId)
    if (!up.ok) return NextResponse.json({ error: up.error ?? 'Không lưu trường mặc định.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, schoolId, canonicalName: ensureSchoolPrefix(canonicalName) })
}
