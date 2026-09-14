import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'

/**
 * Nhóm đánh giá / hỏi đáp sau scrape — luật từ-khóa 188 (product_rating_question_groups).
 */

const RATING_GROUPS: Array<[string, number]> = [
  ['áo da nam', 1],
  ['đồ ngủ nam', 2],
  ['áo giữ nhiệt nữ', 3],
  ['bikini nữ', 4],
  ['vest nam', 5],
  ['váy đầm đầm maxi nữ', 6],
  ['váy đầm maxi nữ', 6],
  ['áo phông nữ', 7],
  ['áo dài nữ', 8],
  ['áo da nữ', 9],
  ['vest nữ', 10],
  ['dép tăng chiều cao nữ', 11],
  ['áo jean nam', 12],
  ['dép xăng đan nam', 13],
  ['giày lười nữ', 14],
  ['giày lười nam', 15],
  ['dép lê nam', 16],
  ['quần jean nữ', 17],
  ['giày sneaker nam', 18],
  ['giày trung niên nữ', 19],
  ['martin nam', 20],
  ['giày dép nam', 21],
  ['sandal nam', 22],
  ['giày thể thao nam', 23],
  ['giày dép nữ', 24],
  ['quần jean nam', 25],
  ['dây lưng nam', 26],
  ['giày sneaker nữ', 27],
  ['giày da nữ', 28],
  ['áo sơ mi nam', 29],
  ['giày da nam', 30],
  ['boot nam', 30],
  ['áo lót nam', 31],
  ['giày tăng chiều cao nam', 32],
  ['martin nữ', 33],
  ['giày bệt nữ', 34],
  ['giày cao gót nữ', 35],
  ['giày thể thao nữ', 36],
  ['sandal nữ', 37],
  ['set đồ bộ nam', 38],
  ['đồ bộ nam', 38],
  ['áo lót nữ', 39],
  ['váy đầm liền thân dự tiệc nữ', 40],
  ['set đồ bộ nam nữ', 42],
  ['đồ bộ nam nữ', 61],
  ['áo len nam nữ', 43],
  ['quần nam nữ', 44],
  ['áo khoác nam nữ', 45],
  ['quần nam', 46],
  ['áo len nữ', 47],
  ['áo thun nữ', 48],
  ['áo khoác nam', 49],
  ['áo len nam', 50],
  ['áo thun nam', 51],
  ['túi xách nam', 52],
  ['ví nam', 53],
  ['chân váy đầm nữ', 54],
  ['đồ ngủ nữ', 55],
  ['áo gió nữ', 56],
  ['quần nữ', 57],
  ['áo sơ mi nữ', 58],
  ['váy đầm liền thân nữ', 59],
  ['áo khoác nữ', 60],
  ['set đồ bộ nữ', 61],
  ['đồ bộ nữ', 61],
  ['đồng hồ nữ nữ', 62],
  ['đồng hồ nam nam nữ', 63],
  ['đồng hồ nam nam', 64],
  ['dép lê nữ', 65],
  ['dép lê nam nữ', 65],
  ['boot nữ', 66],
  ['giày tăng chiều cao nữ', 67],
  ['ví nữ', 68],
  ['túi xách nữ', 69],
  ['lắc tay nữ', 70],
  ['lắc tay nam', 71],
  ['vòng cổ nữ', 72],
  ['vòng cổ nam', 73],
  ['mũ nữ', 74],
  ['nhẫn nữ', 75],
  ['trang sức nữ', 75],
  ['nhẫn nam', 76],
  ['nhẫn nam nữ', 77],
  ['bông tai nữ', 78],
  ['hàng sale', 79],
  ['áo lông nữ', 80],
  ['áo lông nam', 81],
  ['áo nỉ nam', 82],
  ['áo nỉ nữ', 83],
  ['áo lông nam nữ', 80],
  ['vest nam nữ', 5],
  ['áo sơ mi nam nữ', 29],
  ['giày thể thao nam nữ', 23],
  ['máy hút bụi', 84],
  ['áo hai dây nữ', 85],
  ['bóng golf', 88],
  ['cỏ nhân tạo', 89],
  ['găng tay chơi golf', 91],
  ['gậy đánh golf', 92],
  ['túi gậy golf', 93],
  ['vali túi du lịch', 94],
  ['ốp điện thoại', 95],
]

const RATING_ALIASES: Array<[string, number]> = [
  ['váy maxi nữ', 6],
  ['đầm maxi nữ', 6],
  ['sandal cao gót nữ', 35],
  ['giày sandal cao gót nữ', 35],
  ['sandal gót nữ', 35],
  ['dép sandal nữ', 37],
  ['sandal xỏ ngón nữ', 37],
  ['sandal quai hậu nữ', 37],
  ['giày sandal nữ', 37],
  ['sneaker nữ', 27],
  ['giày sneaker nữ', 27],
  ['sneaker nam', 18],
  ['boot cổ thấp nữ', 66],
  ['boot cổ cao nữ', 66],
  ['túi đeo chéo nữ', 69],
  ['balo nữ', 69],
  ['vali du lịch', 94],
  ['vali hành lý', 94],
  ['hành lý du lịch', 94],
  ['vali điện', 94],
  ['túi du lịch', 94],
  ['ốp lưng điện thoại', 95],
  ['case điện thoại', 95],
  ['ốp lưng', 95],
  ['gậy golf', 92],
  ['gậy chơi golf', 92],
  ['túi đựng gậy golf', 93],
  ['găng tay golf', 91],
  ['thảm cỏ nhân tạo', 89],
]

export const RATING_GROUP_ID_UNASSIGNED = 888

const GENERIC_RATING_PHRASES = new Set(['giày dép nam', 'giày dép nữ'])
const SPECIFICITY_DEBOOST_MAX_GAP = 2

const RATING_SORTED: Array<[string, number]> = (() => {
  const m = new Map<string, number>()
  for (const [phrase, gid] of [...RATING_ALIASES, ...RATING_GROUPS]) {
    const key = phrase.trim().toLocaleLowerCase()
    if (key) m.set(key, gid)
  }
  return [...m.entries()].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))
})()

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

export function inferRatingGroupIdFromText(context: string): number {
  const hay = normCtx(context)
  if (!hay) return 0
  const matched: Array<[string, number]> = []
  for (const [phrase, gid] of RATING_SORTED) {
    if (hay.includes(phrase)) matched.push([phrase, gid])
  }
  if (!matched.length) return 0
  const maxlen = Math.max(...matched.map((x) => x[0].length))
  const specifics = matched.filter((x) => !GENERIC_RATING_PHRASES.has(x[0]))
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

const RATING_GROUP_ID_WHITELIST = new Set(
  [...RATING_GROUPS, ...RATING_ALIASES].map(([, gid]) => gid)
)

function ratingGroupCatalogTextForPrompt(): string {
  const canon = new Map<number, string>()
  for (const [phrase, gid] of RATING_GROUPS) {
    const q = phrase.trim()
    if (!q) continue
    const cur = canon.get(gid)
    if (cur == null || q.length < cur.length) canon.set(gid, q)
  }
  for (const gid of [...RATING_GROUP_ID_WHITELIST].sort((a, b) => a - b)) {
    if (!canon.has(gid)) canon.set(gid, `(id=${gid})`)
  }
  return [...canon.entries()]
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

function ratingCatalogForPrompt(): string {
  const catalog = ratingGroupCatalogTextForPrompt()
  if (catalog.length <= PROMPT_CATALOG_MAX_CHARS) return catalog
  return `${catalog.slice(0, PROMPT_CATALOG_MAX_CHARS)}\n...[truncated]`
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
  text: string
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
    return {
      rating: rid != null && RATING_GROUP_ID_WHITELIST.has(rid) ? rid : 0,
      question: qid != null && VALID_QUESTION_GROUP_IDS.has(qid) ? qid : null,
    }
  } catch {
    return null
  }
}

async function deepseekFallbackImportGroups(
  contextText: string,
  productName: string,
  warnings: string[]
): Promise<{ rating: number; question: number | null }> {
  if (!listingImportDeepseekGroupsEnabled()) return { rating: 0, question: null }
  const catalog = ratingCatalogForPrompt()
  const whitelistIds = [...RATING_GROUP_ID_WHITELIST].sort((a, b) => a - b).join(',')
  const r = await deepseekPartnerChat(
    'Bạn gán hai mã cố định cho một sản phẩm thương mại Việt Nam.\n\n' +
      'Quy tắc nhóm **câu hỏi** (question_group_id), chỉ một trong ba số sau:\n' +
      '- **99**: không phân biệt giới hoặc unisex nam-nữ trong tên/ngữ cảnh (hoặc không suy được).\n' +
      '- **100**: sản phẩm dành **nam** (hoặc từ chỉ nam rõ ràng).\n' +
      '- **88**: sản phẩm dành **nữ** (hoặc từ chỉ nữ rõ ràng).\n\n' +
      'Quy tắc nhóm **đánh giá** (rating_group_id):\n' +
      '- Chọn **exactly một** id số trong bảng có dạng `id:ví-dụ cụm` sau đây (chỉ số trong whitelist).\n' +
      '- Ưu tiên đúng **loại hàng + giới** theo NGỮ CẢNH (danh mục, tên).\n\n' +
      'Đầu ra: **JSON thuần** một object, không markdown:\n' +
      '{"rating_group_id": <int whitelist>, "question_group_id": 88 hoặc 99 hoặc 100}\n',
    `WHITELIST rating_group_id (chỉ được chọn một số trong tập): [${whitelistIds}]\n\n` +
      `Bảng chi tiết (id : nhãn):\n${catalog}\n\n` +
      `NGỮ CẢNH (taxonomy + slug + JSON + tên, có thể lẫn ngoại ngữ):\n${contextText.slice(0, 40000)}\n\n` +
      `TÊN SẢN PHẨM:\n${productName.slice(0, 2000)}\n`,
    { feature: 'listing-import-groups', userId: null }
  )
  if (r.error || !r.text) {
    if (r.error) warnings.push(`deepseek_groups: ${r.error}`)
    return { rating: 0, question: null }
  }
  const parsed = parseGroupsAiJson(r.text)
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
  warnings: string[]
): Promise<{ rating: number; question: number | null }> {
  if (!listingImportGeminiGroupsEnabled()) return { rating: 0, question: null }
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return { rating: 0, question: null }
  const catalog = ratingCatalogForPrompt()
  const whitelistIds = [...RATING_GROUP_ID_WHITELIST].sort((a, b) => a - b).join(',')
  const prompt =
    'Bạn gán hai mã cố định cho một sản phẩm TMĐT Việt Nam.\n' +
    'Tên/ngữ cảnh có thể là tiếng Trung, Mông Cổ, Anh hoặc ngôn ngữ khác; hãy hiểu/diễn dịch sang loại hàng tiếng Việt trước khi chọn mã.\n\n' +
    'Quy tắc question_group_id, chỉ một trong ba số:\n' +
    '- 99: unisex/nam-nữ/không phân biệt giới hoặc không suy được.\n' +
    '- 100: sản phẩm dành nam.\n' +
    '- 88: sản phẩm dành nữ.\n\n' +
    'Quy tắc rating_group_id:\n' +
    '- Chọn exactly một id trong whitelist và bảng id:nhãn bên dưới.\n' +
    '- Ưu tiên đúng loại hàng + giới theo tên, taxonomy, style, material, color và product_info.\n' +
    '- Không tạo id mới.\n\n' +
    'Đầu ra JSON thuần một object, không markdown:\n' +
    '{"rating_group_id": <int whitelist>, "question_group_id": 88 hoặc 99 hoặc 100}\n\n' +
    `WHITELIST rating_group_id: [${whitelistIds}]\n\n` +
    `Bảng chi tiết:\n${catalog}\n\n` +
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
    const parsed = parseGroupsAiJson(text)
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
  warnings: string[]
): Promise<{ rating: number; question: number | null }> {
  const ds = await deepseekFallbackImportGroups(contextText, productName, warnings)
  let rating = ds.rating
  let question = ds.question
  if (rating <= 0) {
    const gemini = await geminiFallbackImportGroups(contextText, productName, warnings)
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
  warnings: string[]
): Promise<void> {
  const autoLv = String(productData._taxonomy_auto_created_levels || '').trim()
  if (autoLv) {
    productData.group_rating = RATING_GROUP_ID_UNASSIGNED
    productData.group_question = 0
    warnings.push(`import_groups: taxonomy vừa tạo cấp [${autoLv}] — để trống nhóm đánh giá (888) và nhóm câu hỏi (0).`)
    return
  }
  const pname = String(productData.name || '').trim()
  const ctx = buildImportRatingContextText(productData)
  let rid = inferRatingGroupIdFromText(ctx)
  let qid = inferQuestionGroupIdFromProductName(pname)
  if (rid <= 0) {
    const ai = await aiFallbackImportGroups(ctx, pname, warnings)
    if (ai.rating > 0) rid = ai.rating
    if (ai.question != null) qid = ai.question
    if (rid <= 0) warnings.push('import_groups: chưa khớp từ-khóa — giữ nhóm đánh giá 888.')
  }
  productData.group_rating = coalesceGroupRating(productData.group_rating, rid)
  productData.group_question = qid
}
