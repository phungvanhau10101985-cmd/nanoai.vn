import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  findSchoolByNormalizedName,
  insertSchool,
  searchSchoolsForTeacher,
  upsertTeacherDefaultSchool,
} from '@/lib/db/schools-repo'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

function normalizeSchoolName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTokens(input: string): string[] {
  return normalizeSchoolName(input)
    .split(' ')
    .map((x) => x.trim())
    .filter(Boolean)
}

const GENERIC_SCHOOL_TOKENS = new Set([
  'truong', 'hoc', 'tieu', 'th', 'thcs', 'thpt', 'dai', 'cao', 'cap', 'co', 'so',
  'lien', 'quan', 'huyen', 'xa', 'phuong', 'thi', 'tp', 'thanh', 'pho', '3', '2', '1',
])

function toSearchTokens(input: string): string[] {
  const tokens = toTokens(input)
  const filtered = tokens.filter((t) => t.length >= 2 && !GENERIC_SCHOOL_TOKENS.has(t))
  return filtered.length > 0 ? filtered : tokens.filter((t) => t.length >= 2)
}

function cleanSchoolLabel(input: string): string {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-(),./:&]/gu, '')
    .trim()
}

function ensureSchoolPrefix(input: string): string {
  const cleaned = cleanSchoolLabel(input)
  if (!cleaned) return ''
  const lower = cleaned.toLowerCase()
  if (lower.includes('truong')) return cleaned
  if (lower.includes('trường')) return cleaned
  return `Trường ${cleaned}`.replace(/\s+/g, ' ').trim()
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
  if (!q) return NextResponse.json({ items: [], canCreate: false })

  const normalized = normalizeSchoolName(q)
  const queryTokens = toSearchTokens(q)
  const firstToken = queryTokens[0] ?? normalized
  let data: Awaited<ReturnType<typeof searchSchoolsForTeacher>>
  try {
    data = await searchSchoolsForTeacher(q, firstToken)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const minTokenMatch = 1
  const filtered = (data || []).filter((x) => {
    const rowTokens = new Set(toSearchTokens(String(x.search_tokens || x.normalized_name || x.name || '')))
    let matched = 0
    for (const token of queryTokens) {
      if (rowTokens.has(token)) matched += 1
      if (matched >= minTokenMatch) return true
    }
    return false
  })

  const items = filtered.slice(0, 20).map((x) => ({
    id: String(x.id),
    name: String(x.name ?? '').trim(),
  }))
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

  return NextResponse.json({
    items: mergedItems,
    canCreate: normalized.length >= 3 && !existsExact,
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
  const name = String(body?.name ?? '').trim()
  const useAi = Boolean(body?.useAi ?? false)
  const setAsDefault = Boolean(body?.setAsDefault ?? true)
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
  }

  if (setAsDefault) {
    const up = await upsertTeacherDefaultSchool(user.id, schoolId)
    if (!up.ok) return NextResponse.json({ error: up.error ?? 'Không lưu trường mặc định.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, schoolId, canonicalName: ensureSchoolPrefix(canonicalName) })
}
