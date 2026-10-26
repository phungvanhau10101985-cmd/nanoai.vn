import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  appendSchoolSearchTokens,
  fetchSchoolByIdPg,
  findSchoolByNormalizedName,
  insertSchool,
  proposeSchoolNameEdit,
  searchSchoolsWithEdits,
  upsertTeacherDefaultSchool,
  voteSchoolName,
} from '@/lib/db/schools-repo'
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
  schoolSuggestionContainsQuery,
  toSearchTokens,
} from '@/lib/school-name'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

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
    const knownKeys = new Set(already.map((name) => normalizeSchoolName(ensureSchoolPrefix(name))))
    const queryTokens = toSearchTokens(query)
    const matched = parseSuggestedSchools(text).filter((name) => {
      if (schoolSuggestionContainsQuery(name, query)) return true
      if (queryTokens.length === 0) return false
      const nameTokens = new Set(toSearchTokens(name))
      return queryTokens.every((token) => nameTokens.has(token))
    })
    return filterSchoolSuggestions(matched, query, 8)
      .concat(matched.filter((name) => !schoolSuggestionContainsQuery(name, query)))
      .filter((name, index, all) => {
        const key = normalizeSchoolName(ensureSchoolPrefix(name))
        if (!key || knownKeys.has(key)) return false
        return all.findIndex((item) => normalizeSchoolName(ensureSchoolPrefix(item)) === key) === index
      })
      .slice(0, 4)
  } catch {
    return []
  }
}

async function saveSchoolNames(names: string[], userId: string, query = ''): Promise<void> {
  const extra = toSearchTokens(query).join(' ')
  for (const raw of names) {
    const canonicalName = ensureSchoolPrefix(raw)
    const normalized = normalizeSchoolName(canonicalName)
    if (!normalized) continue
    const existing = await findSchoolByNormalizedName(normalized)
    if (existing?.id) {
      if (extra) await appendSchoolSearchTokens(existing.id, extra)
      continue
    }
    const searchTokens = extra ? `${normalized} ${extra}` : normalized
    try {
      await insertSchool({
        name: canonicalName,
        normalizedName: normalized,
        searchTokens,
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
  edited_name?: string | null
  edited_normalized?: string | null
}

function schoolTextMatches(hayRaw: string, normalized: string, queryTokens: string[]): boolean {
  const hay = normalizeSchoolName(hayRaw)
  if (!hay) return false
  if (normalized && hay.includes(normalized)) return true
  if (queryTokens.length === 0) return false
  const rowTokens = new Set(toSearchTokens(hayRaw))
  return queryTokens.every((token) => rowTokens.has(token))
}

async function listMatchingSchools(
  q: string
): Promise<Array<{ id: string; name: string; choice: 'original' | 'edited' | null }>> {
  const normalized = normalizeSchoolName(q)
  const queryTokens = toSearchTokens(q)
  const data = await searchSchoolsWithEdits(q, normalized)
  const listed: Array<{ id: string; name: string; choice: 'original' | 'edited' | null }> = []
  for (const row of data || []) {
    const hit = row as SchoolHit
    const originalHay = `${hit.name} ${hit.normalized_name} ${hit.search_tokens}`
    const editedHay = `${hit.edited_name || ''} ${hit.edited_normalized || ''}`
    const matched =
      schoolTextMatches(originalHay, normalized, queryTokens) || schoolTextMatches(editedHay, normalized, queryTokens)
    if (!matched) continue
    const editedName = String(hit.edited_name ?? '').trim()
    listed.push({
      id: String(hit.id),
      name: String(hit.name ?? '').trim(),
      choice: editedName ? 'original' : null,
    })
    if (editedName) {
      listed.push({ id: String(hit.id), name: editedName, choice: 'edited' })
    }
    if (listed.length >= 40) break
  }
  return listed
}

/** Deepseek đưa tên trường về một cách viết dùng chung. Không đổi cấp và không thêm địa danh. */
async function canonicalizeSchoolNameByDeepseek(input: string, userId?: string | null): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return null
  const model = resolveDeepSeekChatModel()
  const prompt = `Chuẩn hoá tên trường học tại Việt Nam từ chuỗi giáo viên nhập, để nhiều người cùng dùng một tên.
Trả về đúng JSON một dòng: {"schoolName":"..."}
- Viết hoa tên riêng. Thêm "Trường" nếu thiếu.
- Giữ đúng cấp giáo viên đã gõ (Tiểu học, THCS, THPT, Đại học). Không tự đổi sang cấp khác và không thêm địa danh họ không gõ.
- Không giải thích.
Input: ${input}`
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
          max_tokens: 200,
          temperature: 0,
        })
      ),
      signal: AbortSignal.timeout(20000),
    })
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(json.choices?.[0]?.message?.content ?? '')
    trackOpenAiStyleCompletionUsage({
      userId: userId ?? null,
      model,
      feature: 'schools-search-canonicalize-deepseek',
      usage: json.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    if (!res.ok) return null
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as { schoolName?: unknown }
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
    aiSuggestedName = await canonicalizeSchoolNameByDeepseek(q, auth.user?.id ?? null)
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

  if (mergedItems.length > 0 || !wantSuggest || !auth.user?.id || normalized.length < 3) {
    const listedExact = mergedItems.some((item) => normalizeSchoolName(item.name) === normalized)
    return NextResponse.json({
      items: mergedItems,
      suggestions: [],
      canCreate: normalized.length >= 3 && !listedExact,
      suggestedName: q,
      aiSuggestedName,
      aiMatchedExisting,
    })
  }

  const suggestions = await suggestSchoolNamesWithDeepseek(q, [], auth.user.id)
  return NextResponse.json({
    items: [],
    suggestions,
    canCreate: true,
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
    const action = String(body?.action ?? '').trim()
    if (action === 'rename') {
      const rawName = ensureSchoolPrefix(String(body?.name ?? '').trim())
      const editedNormalized = normalizeSchoolName(rawName)
      if (!editedNormalized || rawName.length < 3) {
        return NextResponse.json({ error: 'Tên trường quá ngắn.' }, { status: 400 })
      }
      const proposed = await proposeSchoolNameEdit({
        schoolId: schoolIdBody,
        teacherId: user.id,
        editedName: rawName,
        editedNormalized,
      })
      if (!proposed.ok) return NextResponse.json({ error: proposed.error }, { status: 400 })
      return NextResponse.json({ success: true, schoolId: schoolIdBody, canonicalName: proposed.canonicalName })
    }
    const choice = body?.choice === 'edited' || body?.choice === 'original' ? body.choice : null
    let canonicalName = ''
    if (choice) {
      const voted = await voteSchoolName({ schoolId: schoolIdBody, teacherId: user.id, choice })
      if (!voted.ok) return NextResponse.json({ error: voted.error }, { status: 400 })
      canonicalName = voted.canonicalName
    } else {
      const school = await fetchSchoolByIdPg(schoolIdBody)
      if (!school?.id) return NextResponse.json({ error: 'Không tìm thấy trường đã chọn.' }, { status: 404 })
      canonicalName = school.name
    }
    if (setAsDefault) {
      const up = await upsertTeacherDefaultSchool(user.id, schoolIdBody)
      if (!up.ok) return NextResponse.json({ error: up.error ?? 'Không lưu trường mặc định.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, schoolId: schoolIdBody, canonicalName })
  }

  const name = String(body?.name ?? '').trim()
  const siblingNames = Array.isArray(body?.siblingNames)
    ? (body.siblingNames as unknown[]).map((item) => String(item ?? '').trim()).filter((item) => item.length >= 3)
    : []
  const query = String(body?.query ?? name).trim()
  if (name.length < 3) {
    return NextResponse.json({ error: 'Tên trường quá ngắn.' }, { status: 400 })
  }

  const canonicalName = ensureSchoolPrefix((await canonicalizeSchoolNameByDeepseek(name, user.id)) || name)
  const normalized = normalizeSchoolName(canonicalName)
  if (!normalized) return NextResponse.json({ error: 'Tên trường không hợp lệ.' }, { status: 400 })

  if (siblingNames.length > 0) {
    await saveSchoolNames([canonicalName, ...siblingNames], user.id, query)
  }

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
