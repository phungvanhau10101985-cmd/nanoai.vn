import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  fetchPartnerRatingGroupPhraseRowsFromPg,
  type PartnerRatingGroupPhraseRow,
} from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerImportedReviewGroupIdsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'

/**
 * Nhóm đánh giá / hỏi đáp sau scrape — cùng thuật toán 188 (từ-khóa rồi AI whitelist),
 * nhưng catalog lấy theo từng shop: pool Excel admin import + nhãn L1/L2/L3 SP đã gán nhóm.
 * Không dùng bảng cụm cứng của shop 188.com.vn.
 */

export const RATING_GROUP_ID_UNASSIGNED = 888

const SPECIFICITY_DEBOOST_MAX_GAP = 2

export type PartnerRatingGroupCatalog = {
  groupIds: number[]
  phrases: Array<[string, number]>
  genericPhrases: Set<string>
  labels: Map<number, string>
}

export function emptyPartnerRatingGroupCatalog(): PartnerRatingGroupCatalog {
  return { groupIds: [], phrases: [], genericPhrases: new Set(), labels: new Map() }
}

export function buildPartnerRatingGroupCatalog(
  importedGroupIds: number[],
  rows: PartnerRatingGroupPhraseRow[]
): PartnerRatingGroupCatalog {
  const groupIds = [...new Set(importedGroupIds.map((n) => Math.round(Number(n))).filter((n) => n > 0 && n !== 888 && n !== 1000))]
  const allow = new Set(groupIds)
  const phrases: Array<[string, number]> = []
  const add = (raw: string, gid: number, minLen = 3) => {
    const p = String(raw || '').trim().replace(/\s+/g, ' ')
    if (p.length < minLen) return
    phrases.push([p, gid])
  }
  const l1Owners = new Map<string, Set<number>>()
  for (const row of rows) {
    const gid = Math.round(Number(row.ratingGroupId))
    if (!allow.has(gid)) continue
    add(row.categoryL3, gid, 3)
    add(row.categoryL2, gid, 6)
    add(row.categoryL1, gid, 8)
    const l1 = String(row.categoryL1 || '').trim()
    const cf1 = l1.toLocaleLowerCase()
    let gender = ''
    if (cf1.endsWith(' nữ')) gender = 'nữ'
    else if (cf1.endsWith(' nam')) gender = 'nam'
    if (gender) {
      const l2 = String(row.categoryL2 || '').trim()
      const l3 = String(row.categoryL3 || '').trim()
      if (l2 && !l2.toLocaleLowerCase().includes(gender)) add(`${l2} ${gender}`, gid, 6)
      if (l3 && !l3.toLocaleLowerCase().includes(gender)) add(`${l3} ${gender}`, gid, 3)
    }
    if (cf1) {
      const owners = l1Owners.get(cf1) ?? new Set<number>()
      owners.add(gid)
      l1Owners.set(cf1, owners)
    }
  }
  const genericPhrases = new Set<string>()
  for (const [phrase, owners] of l1Owners) {
    if (owners.size >= 2) genericPhrases.add(phrase)
  }
  const pickShorter = (cur: string | undefined, next: string): string | undefined => {
    const n = String(next || '').trim()
    if (n.length < 3) return cur
    if (cur == null || n.length < cur.length) return n
    return cur
  }
  const l3ByGid = new Map<number, string>()
  const l2ByGid = new Map<number, string>()
  const l1ByGid = new Map<number, string>()
  for (const row of rows) {
    const gid = Math.round(Number(row.ratingGroupId))
    if (!allow.has(gid)) continue
    const l3 = pickShorter(l3ByGid.get(gid), row.categoryL3)
    if (l3) l3ByGid.set(gid, l3)
    const l2 = pickShorter(l2ByGid.get(gid), row.categoryL2)
    if (l2) l2ByGid.set(gid, l2)
    const l1 = pickShorter(l1ByGid.get(gid), row.categoryL1)
    if (l1) l1ByGid.set(gid, l1)
  }
  const labels = new Map<number, string>()
  for (const gid of groupIds) {
    const label = (l3ByGid.get(gid) || l2ByGid.get(gid) || l1ByGid.get(gid) || '').trim()
    labels.set(gid, label.length >= 3 ? label : `(id=${gid})`)
  }
  return { groupIds, phrases, genericPhrases, labels }
}

function sortRatingPhrases(pairs: Array<[string, number]>): Array<[string, number]> {
  const m = new Map<string, number>()
  for (const [phrase, gid] of pairs) {
    const key = phrase.trim().toLocaleLowerCase()
    if (key) m.set(key, gid)
  }
  return [...m.entries()].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))
}

function normCtx(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function inferQuestionGroupIdFromProductName(productName: string): number {
  const t = normCtx(productName || '')
  if (!t) return 99
  if (t.includes('nam nữ')) return 99
  if (t.includes('nam')) return 100
  if (t.includes('nữ')) return 88
  return 99
}

export function inferRatingGroupIdFromText(
  context: string,
  phrases: Array<[string, number]> = [],
  genericPhrases: Iterable<string> = []
): number {
  const hay = normCtx(context)
  if (!hay || phrases.length === 0) return 0
  const generic = new Set([...genericPhrases].map((s) => s.trim().toLocaleLowerCase()).filter(Boolean))
  const matched: Array<[string, number]> = []
  for (const [phrase, gid] of sortRatingPhrases(phrases)) {
    if (hay.includes(phrase)) matched.push([phrase, gid])
  }
  if (!matched.length) return 0
  const maxlen = Math.max(...matched.map((x) => x[0].length))
  const specifics = matched.filter((x) => !generic.has(x[0]))
  if (specifics.length) {
    const bestSpecLen = Math.max(...specifics.map((x) => x[0].length))
    if (maxlen - bestSpecLen <= SPECIFICITY_DEBOOST_MAX_GAP) {
      return specifics.reduce((best, cur) =>
        cur[0].length > best[0].length || (cur[0].length === best[0].length && cur[0] > best[0]) ? cur : best
      )[1]
    }
  }
  return matched.reduce((best, cur) =>
    cur[0].length > best[0].length || (cur[0].length === best[0].length && cur[0] > best[0]) ? cur : best
  )[1]
}

function slugAsWords(slug: string): string {
  return (slug || '').replace(/[/\\_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildImportRatingContextText(productData: Record<string, unknown>): string {
  const parts: string[] = []
  const add = (val: unknown) => {
    const s = String(val || '').trim()
    if (s) parts.push(s)
  }
  for (const key of [
    'category',
    'subcategory',
    'sub_subcategory',
    'raw_category',
    'raw_subcategory',
    'raw_sub_subcategory',
    'name',
    'material',
    'style',
    'color',
    'occasion',
    'features',
    'weight',
  ]) {
    add(productData[key])
  }
  for (const sk of ['slug_seo', 'full_slug', 'cat3_full_slug']) add(slugAsWords(String(productData[sk] || '')))
  const pi = productData.product_info
  if (pi && typeof pi === 'object') {
    const rec = pi as Record<string, unknown>
    const inner = rec.product_info
    if (inner && typeof inner === 'object') {
      const inn = inner as Record<string, unknown>
      const cat = inn.category
      if (cat && typeof cat === 'object') {
        const c = cat as Record<string, unknown>
        add(c.level_1)
        add(c.level_2)
        add(c.level_3)
      }
      add(inn.target_audience_suggestion_vi)
    }
    const meta = rec.import_taxonomy_meta
    if (meta && typeof meta === 'object') add((meta as Record<string, unknown>).khach_hang_vi)
  }
  const cat1 = String(productData.category || '').trim()
  const cf1 = cat1.toLocaleLowerCase()
  let genderTail = ''
  if (cf1.endsWith(' nữ')) genderTail = 'nữ'
  else if (cf1.endsWith(' nam')) genderTail = 'nam'
  if (genderTail) {
    for (const key of ['subcategory', 'sub_subcategory', 'raw_subcategory', 'raw_sub_subcategory']) {
      const seg = String(productData[key] || '').trim()
      if (seg && !seg.toLocaleLowerCase().includes(genderTail)) parts.push(`${seg} ${genderTail}`)
    }
  }
  return parts.join(' ')
}

export async function loadPartnerRatingGroupCatalog(partnerId: string): Promise<PartnerRatingGroupCatalog> {
  const ids = await fetchPartnerImportedReviewGroupIdsFromPg(partnerId)
  if (ids.length === 0) return emptyPartnerRatingGroupCatalog()
  const rows = await fetchPartnerRatingGroupPhraseRowsFromPg(partnerId, ids)
  return buildPartnerRatingGroupCatalog(ids, rows)
}

function ratingWhitelist(catalog: PartnerRatingGroupCatalog): Set<number> {
  const out = new Set<number>()
  for (const [, gid] of catalog.phrases) {
    if (gid > 0 && gid !== 888 && gid !== 1000) out.add(gid)
  }
  return out
}

function isPlaceholderGroupLabel(label: string): boolean {
  return /^\(id=\d+\)$/.test(label.trim())
}

function ratingGroupCatalogTextForPrompt(catalog: PartnerRatingGroupCatalog): string {
  const allow = ratingWhitelist(catalog)
  return [...catalog.labels.entries()]
    .filter(([gid, label]) => allow.has(gid) && !isPlaceholderGroupLabel(label))
    .sort((a, b) => a[0] - b[0])
    .map(([gid, label]) => `${gid}: ${label}`)
    .join('\n')
}

const PROMPT_CATALOG_MAX_CHARS = 100_000
const VALID_QUESTION_GROUP_IDS = new Set([88, 99, 100])

function envFlagOff(raw: string | undefined): boolean {
  const v = (raw || '').trim().toLowerCase()
  return v === '0' || v === 'false' || v === 'off'
}

function listingImportGroupsAiSkipped(): boolean {
  if (process.argv.includes('--test')) return true
  return envFlagOff(process.env.LISTING_IMPORT_GROUPS_FALLBACK)
}

function listingImportDeepseekGroupsEnabled(): boolean {
  if (listingImportGroupsAiSkipped()) return false
  if (envFlagOff(process.env.LISTING_IMPORT_DEEPSEEK_GROUPS_FALLBACK)) return false
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
}

function listingImportGeminiGroupsEnabled(): boolean {
  if (listingImportGroupsAiSkipped()) return false
  if (envFlagOff(process.env.LISTING_IMPORT_GEMINI_GROUPS_FALLBACK)) return false
  const key = resolvePartnerWebsiteGeminiApiKey()
  return Boolean(key && key.length >= 10)
}

function ratingCatalogForPrompt(catalog: PartnerRatingGroupCatalog): string {
  const text = ratingGroupCatalogTextForPrompt(catalog)
  if (text.length <= PROMPT_CATALOG_MAX_CHARS) return text
  return `${text.slice(0, PROMPT_CATALOG_MAX_CHARS)}\n...[truncated]`
}

function pullGroupInt(parsed: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const raw = parsed[k]
    if (typeof raw === 'boolean') continue
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number.parseInt(raw.trim(), 10)
  }
  return null
}

function parseGroupsAiJson(
  text: string,
  catalog: PartnerRatingGroupCatalog
): { rating: number; question: number | null } | null {
  const trimmed = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const rec = parsed as Record<string, unknown>
    const rid = pullGroupInt(rec, ['rating_group_id', 'group_rating'])
    const qid = pullGroupInt(rec, ['question_group_id', 'group_question'])
    const allow = ratingWhitelist(catalog)
    return {
      rating: rid != null && allow.has(rid) ? rid : 0,
      question: qid != null && VALID_QUESTION_GROUP_IDS.has(qid) ? qid : null,
    }
  } catch {
    return null
  }
}

async function deepseekFallbackImportGroups(
  contextText: string,
  productName: string,
  warnings: string[],
  catalog: PartnerRatingGroupCatalog
): Promise<{ rating: number; question: number | null }> {
  if (!listingImportDeepseekGroupsEnabled()) return { rating: 0, question: null }
  const allow = ratingWhitelist(catalog)
  if (allow.size === 0) return { rating: 0, question: null }
  const catalogText = ratingCatalogForPrompt(catalog)
  if (!catalogText.trim()) return { rating: 0, question: null }
  const whitelistIds = [...allow].sort((a, b) => a - b).join(',')
  const r = await deepseekPartnerChat(
    'Bạn gán hai mã cố định cho một sản phẩm thương mại Việt Nam.\n\n' +
      'Quy tắc nhóm **câu hỏi** (question_group_id), chỉ một trong ba số sau:\n' +
      '- **99**: không phân biệt giới hoặc unisex nam-nữ trong tên/ngữ cảnh (hoặc không suy được).\n' +
      '- **100**: sản phẩm dành **nam** (hoặc từ chỉ nam rõ ràng).\n' +
      '- **88**: sản phẩm dành **nữ** (hoặc từ chỉ nữ rõ ràng).\n\n' +
      'Quy tắc nhóm **đánh giá** (rating_group_id):\n' +
      '- Chọn **exactly một** id số trong bảng có dạng `id:ví-dụ cụm` sau đây (chỉ số trong whitelist của shop này).\n' +
      '- Ưu tiên đúng **loại hàng + giới** theo NGỮ CẢNH (danh mục, tên).\n' +
      '- Không dùng nhóm của shop khác; không bịa id mới.\n\n' +
      'Đầu ra: **JSON thuần** một object, không markdown:\n' +
      '{"rating_group_id": <int whitelist>, "question_group_id": 88 hoặc 99 hoặc 100}\n',
    `WHITELIST rating_group_id (chỉ được chọn một số trong tập): [${whitelistIds}]\n\n` +
      `Bảng chi tiết (id : nhãn):\n${catalogText}\n\n` +
      `NGỮ CẢNH (taxonomy + slug + JSON + tên, có thể lẫn ngoại ngữ):\n${contextText.slice(0, 40000)}\n\n` +
      `TÊN SẢN PHẨM:\n${productName.slice(0, 2000)}\n`,
    { feature: 'listing-import-groups', userId: null }
  )
  if (r.error || !r.text) {
    if (r.error) warnings.push(`deepseek_groups: ${r.error}`)
    return { rating: 0, question: null }
  }
  const parsed = parseGroupsAiJson(r.text, catalog)
  if (!parsed) {
    warnings.push('deepseek_groups: không đọc được JSON.')
    return { rating: 0, question: null }
  }
  if (parsed.rating <= 0) {
    warnings.push('deepseek_groups: model không trả rating_group_id hợp lệ trong whitelist.')
  }
  return parsed
}

async function geminiFallbackImportGroups(
  contextText: string,
  productName: string,
  warnings: string[],
  catalog: PartnerRatingGroupCatalog
): Promise<{ rating: number; question: number | null }> {
  if (!listingImportGeminiGroupsEnabled()) return { rating: 0, question: null }
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return { rating: 0, question: null }
  const allow = ratingWhitelist(catalog)
  if (allow.size === 0) return { rating: 0, question: null }
  const catalogText = ratingCatalogForPrompt(catalog)
  if (!catalogText.trim()) return { rating: 0, question: null }
  const whitelistIds = [...allow].sort((a, b) => a - b).join(',')
  const prompt =
    'Bạn gán hai mã cố định cho một sản phẩm TMĐT Việt Nam.\n' +
    'Tên/ngữ cảnh có thể là tiếng Trung, Mông Cổ, Anh hoặc ngôn ngữ khác; hãy hiểu/diễn dịch sang loại hàng tiếng Việt trước khi chọn mã.\n\n' +
    'Quy tắc question_group_id, chỉ một trong ba số:\n' +
    '- 99: unisex/nam-nữ/không phân biệt giới hoặc không suy được.\n' +
    '- 100: sản phẩm dành nam.\n' +
    '- 88: sản phẩm dành nữ.\n\n' +
    'Quy tắc rating_group_id:\n' +
    '- Chọn exactly một id trong whitelist và bảng id:nhãn của shop này bên dưới.\n' +
    '- Ưu tiên đúng loại hàng + giới theo tên, taxonomy, style, material, color và product_info.\n' +
    '- Không tạo id mới. Không dùng nhóm của shop khác.\n\n' +
    'Đầu ra JSON thuần một object, không markdown:\n' +
    '{"rating_group_id": <int whitelist>, "question_group_id": 88 hoặc 99 hoặc 100}\n\n' +
    `WHITELIST rating_group_id: [${whitelistIds}]\n\n` +
    `Bảng chi tiết:\n${catalogText}\n\n` +
    `NGỮ CẢNH (có thể gồm nhiều cột Excel/import):\n${contextText.slice(0, 40000)}\n\n` +
    `TÊN SẢN PHẨM:\n${productName.slice(0, 2000)}\n`
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: { temperature: 0.1, maxOutputTokens: 180 },
    })
    const result = await model.generateContent(prompt)
    let text = ''
    try {
      text = result.response.text()?.trim() || ''
    } catch {
      const parts = result.response.candidates?.[0]?.content?.parts || []
      text = parts.map((p) => String(p.text || '')).join('').trim()
    }
    if (!text) {
      warnings.push('gemini_groups: không có candidates.')
      return { rating: 0, question: null }
    }
    const parsed = parseGroupsAiJson(text, catalog)
    if (!parsed) {
      warnings.push('gemini_groups: không đọc được JSON.')
      return { rating: 0, question: null }
    }
    if (parsed.rating <= 0) {
      warnings.push('gemini_groups: model không trả rating_group_id hợp lệ trong whitelist.')
    }
    return parsed
  } catch (e) {
    warnings.push(`gemini_groups: lỗi mạng/API: ${e instanceof Error ? e.message : String(e)}`)
    return { rating: 0, question: null }
  }
}

async function aiFallbackImportGroups(
  contextText: string,
  productName: string,
  warnings: string[],
  catalog: PartnerRatingGroupCatalog
): Promise<{ rating: number; question: number | null }> {
  const allow = ratingWhitelist(catalog)
  if (allow.size === 0) return { rating: 0, question: null }
  const ds = await deepseekFallbackImportGroups(contextText, productName, warnings, catalog)
  let rating = ds.rating
  let question = ds.question
  if (rating <= 0) {
    const gemini = await geminiFallbackImportGroups(contextText, productName, warnings, catalog)
    if (rating <= 0) rating = gemini.rating
    if (question == null) question = gemini.question
  }
  return { rating, question }
}

export function coalesceGroupRating(raw: unknown, inferred: number): number {
  if (inferred > 0) return inferred
  if (raw == null || raw === '') return RATING_GROUP_ID_UNASSIGNED
  if (typeof raw === 'boolean') return RATING_GROUP_ID_UNASSIGNED
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const val = Math.trunc(raw)
    if (val === 0 || val === 1000) return RATING_GROUP_ID_UNASSIGNED
    return val > 0 ? val : RATING_GROUP_ID_UNASSIGNED
  }
  const s = String(raw).trim()
  if (!s || ['nan', 'none', 'null'].includes(s.toLowerCase())) return RATING_GROUP_ID_UNASSIGNED
  if (/^-?\d+$/.test(s)) {
    const val = Number.parseInt(s, 10)
    if (val === 0 || val === 1000) return RATING_GROUP_ID_UNASSIGNED
    return val > 0 ? val : RATING_GROUP_ID_UNASSIGNED
  }
  return RATING_GROUP_ID_UNASSIGNED
}

export async function applyListingImportRatingGroups(
  productData: Record<string, unknown>,
  warnings: string[],
  opts?: { partnerId?: string; catalog?: PartnerRatingGroupCatalog }
): Promise<void> {
  const autoLv = String(productData._taxonomy_auto_created_levels || '').trim()
  if (autoLv) {
    productData.group_rating = RATING_GROUP_ID_UNASSIGNED
    productData.group_question = 0
    warnings.push(`import_groups: taxonomy vừa tạo cấp [${autoLv}] — để trống nhóm đánh giá (888) và nhóm câu hỏi (0).`)
    return
  }
  const catalog =
    opts?.catalog ??
    (opts?.partnerId ? await loadPartnerRatingGroupCatalog(opts.partnerId) : emptyPartnerRatingGroupCatalog())
  const allowed = ratingWhitelist(catalog)
  const pname = String(productData.name || '').trim()
  const ctx = buildImportRatingContextText(productData)
  let rid = inferRatingGroupIdFromText(ctx, catalog.phrases, catalog.genericPhrases)
  if (!allowed.has(rid)) rid = 0
  let qid = inferQuestionGroupIdFromProductName(pname)
  if (rid <= 0 && allowed.size > 0) {
    const ai = await aiFallbackImportGroups(ctx, pname, warnings, catalog)
    if (ai.rating > 0) rid = ai.rating
    if (ai.question != null) qid = ai.question
    if (rid <= 0) warnings.push('import_groups: chưa khớp nhóm đánh giá của shop — giữ 888.')
  } else if (rid <= 0) {
    warnings.push('import_groups: shop chưa có nhóm đánh giá (import + SP đã gán) — giữ 888.')
  }
  productData.group_rating = coalesceGroupRating(productData.group_rating, rid)
  productData.group_question = qid
}
