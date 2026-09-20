import { fetchPartnerAllowAutoCreateCategoriesFromPg } from '@/lib/db/messaging-partner-category-auto-create-pg'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { collectListingImportColorLabels } from '@/lib/messaging/listing-import/listing-import-color-translate'
import {
  CATEGORY_AUTO_CREATE_DISABLED,
  ensurePartnerCategoryTripleWithSeo,
  existingPartnerCategoryTripleExists,
} from '@/lib/partner-website/category/partner-category-place-product'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/
const MAX_COLORS_IN_DISPLAY_VI = 4
const MAX_CONTEXT_CHARS = 12_000
const MAX_BLOCK_CHARS = 80_000

const LISTING_SANITIZE_PROMPT_VI = `
KHÔNG ghi năm marketing (2024, 2025, 年新款…) trong ten_tieng_viet / mo_ta_vi / phong_cach_vi.
PHONG CÁCH / MARKETING TRUNG QUỐC: cụm 国风, 国潮, 新中式, 中国风, 中式, 汉风, 汉服, 古风… KHÔNG dịch — BỎ HẲN.
Không ghi «phong cách Trung Quốc/Trung Hoa/tân trung thức/đông phương/Hán phục».
Vẫn được ghi xuất xứ «Trung Quốc» ở xuat_xu_vi khi có thông tin thật.
`

const TAXONOMY_CLASSIFICATION_RULES_VI = `
QUY TẮC PHÂN LOẠI:
ĐẦU RA JSON đúng 14 key: cat1, cat2, cat3, khach_hang, ten_tieng_viet, chat_lieu_vi, mo_ta_vi,
thuong_hieu_vi, xuat_xu_vi, phong_cach_vi, dip_vi, trong_luong_vi, chieu_cao_got_vi, thong_so_kich_thuoc_vi.
- cat1/cat2/cat3: SAO CHÉP NGUYÊN VĂN một bộ hợp lệ từ BẢNG DANH MỤC khi có.
- TUYỆT ĐỐI KHÔNG dùng ký tự tiếng Trung/Nhật/Hàn trong BẤT KỲ giá trị JSON nào.
- khach_hang: tiếng Việt ngắn — đối tượng (tuổi, giới).
- ten_tieng_viet: tên tiếng Việt tự nhiên ≤220 ký tự. KHÔNG ghi danh sách màu. KHÔNG liệt kê hết size.
- chat_lieu_vi: chất liệu tiếng Việt ngắn; không đoán — không có thì "".
- mo_ta_vi: mô tả bán hàng tiếng Việt, 350–1200 ký tự, 2–5 đoạn, \\n giữa đoạn; không HTML; không copy bảng thông số.
- phong_cach_vi / dip_vi: tiếng Việt ngắn khi có; không có thì "".
QUY TẮC cat1:
- Giày dép → «Giày dép Nam» hoặc «Giày dép Nữ».
- Quần áo / váy → «Thời trang Nam» hoặc «Thời trang Nữ».
- Túi / ví / ba lô → «Túi xách Nam» hoặc «Túi xách Nữ».
${LISTING_SANITIZE_PROMPT_VI}
`

function taxonomyNoMatchPromptLine(allowCreate: boolean): string {
  return allowCreate
    ? 'Ưu tiên cat1/cat2/cat3 nguyên văn trong bảng; nếu thiếu nhánh thì đề xuất tên Việt mới (giữ cat1/cat2 khi có thể).'
    : 'CHỈ được SAO CHÉP đúng một bộ cat1/cat2/cat3 đã có trong bảng. Nếu không khớp: trả cat1="" cat2="" cat3="". CẤM đề xuất danh mục mới.'
}

export function listingImportOverlayTitle(overlay: Record<string, unknown> | null | undefined): string {
  if (!overlay || typeof overlay !== 'object') return ''
  const chinese = String(overlay.chinese_name ?? '').trim()
  if (chinese) return chinese
  const name = String(overlay.name ?? '').trim()
  if (name) return name
  return String(overlay.title ?? '').trim()
}

type Triple = {
  cat1: string
  cat2: string
  cat3: string
  full_slug?: string
  khach_hang?: string
  ten_tieng_viet?: string
  chat_lieu_vi?: string
  mo_ta_vi?: string
  thuong_hieu_vi?: string
  xuat_xu_vi?: string
  phong_cach_vi?: string
  dip_vi?: string
  trong_luong_vi?: string
  chieu_cao_got_vi?: string
  thong_so_kich_thuoc_vi?: string
  created_levels?: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

function hasCjk(s: string): boolean {
  return CJK_RE.test(s)
}

function scrubPlaceholder(text: string): string {
  const t = (text || '').trim()
  if (!t) return ''
  const low = t.toLowerCase()
  if (['nan', 'none', 'null', 'undefined', 'n/a'].includes(low)) return ''
  return t
}

function scrubCjk(text: string): string {
  return (text || '').replace(CJK_RE, ' ').replace(/\s+/g, ' ').trim()
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function nonemptyField(productData: Record<string, unknown>, key: string): string {
  const s = str(productData[key])
  if (['nan', 'none', 'null'].includes(s.toLowerCase())) return ''
  return s
}

export function extractListingImportJsonObject(content: string): Record<string, unknown> | null {
  let t = (content || '').trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```\w*\s*/, '').replace(/\s*```\s*$/, '')
  }
  try {
    const data = JSON.parse(t) as unknown
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  } catch {
    /* fall through */
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(t.slice(start, end + 1)) as unknown
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

export function appendListingImportColorSuffixToViName(baseVi: string, labels: string[]): string {
  const base = (baseVi || '').trim()
  if (!labels.length) return base
  const pick = labels.length >= MAX_COLORS_IN_DISPLAY_VI ? labels.slice(0, MAX_COLORS_IN_DISPLAY_VI) : [...labels]
  const suffix = pick.join(', ')
  if (!base) return suffix
  return `${base} — ${suffix}`
}

export function inferListingImportSupplierGenderHint(text: string): 'female' | 'male' | null {
  const raw = text || ''
  if (!raw.trim()) return null
  let fScore = 0
  let mScore = 0
  if (/эмэгтэй/i.test(raw)) fScore += 3
  if (/эрэгтэй/i.test(raw)) mScore += 3
  if (/女士|女款|女式/.test(raw)) fScore += 2
  if (/男士|男款|男式/.test(raw)) mScore += 2
  if (/\b(women|woman|female|ladies|lady's)\b/i.test(raw)) fScore += 1
  if (/\b(men|man's|male|gentleman)\b/i.test(raw)) mScore += 1
  if (/giới tính\s*[:：]\s*nữ|dành cho nữ|phụ nữ\b/i.test(raw)) fScore += 2
  if (/giới tính\s*[:：]\s*nam|dành cho nam(\s|,|$)/i.test(raw)) mScore += 2
  if (fScore > mScore) return 'female'
  if (mScore > fScore) return 'male'
  return null
}

function cat1IsGenderedMale(cat1: string): boolean {
  return (cat1 || '').trim().endsWith(' Nam')
}

function cat1IsGenderedFemale(cat1: string): boolean {
  return (cat1 || '').trim().endsWith(' Nữ')
}

function loadActiveCategoryTriples(rows: PartnerCategoryRow[]): Triple[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: Triple[] = []
  for (const c3 of rows) {
    if (!c3.isActive || c3.depth !== 3 || !c3.parentId) continue
    const c2 = byId.get(c3.parentId)
    if (!c2 || !c2.isActive || c2.depth !== 2 || !c2.parentId) continue
    const c1 = byId.get(c2.parentId)
    if (!c1 || !c1.isActive || c1.depth !== 1) continue
    const n1 = c1.name.trim()
    const n2 = c2.name.trim()
    const n3 = c3.name.trim()
    if (!(n1 && n2 && n3)) continue
    out.push({ cat1: n1, cat2: n2, cat3: n3, full_slug: (c3.path || '').replace(/^\//, '') })
  }
  return out
}

function buildTaxonomyPromptBlock(triples: Triple[]): { block: string; truncated: boolean } {
  const grouped = new Map<string, Map<string, string[]>>()
  for (const t of triples) {
    if (!grouped.has(t.cat1)) grouped.set(t.cat1, new Map())
    const l2 = grouped.get(t.cat1)!
    if (!l2.has(t.cat2)) l2.set(t.cat2, [])
    l2.get(t.cat2)!.push(t.cat3)
  }
  const lines: string[] = []
  for (const c1 of [...grouped.keys()].sort()) {
    lines.push(`## ${c1}`)
    const l2map = grouped.get(c1)!
    for (const c2 of [...l2map.keys()].sort()) {
      for (const c3 of [...new Set(l2map.get(c2)!)].sort()) {
        lines.push(`- ${c2} > ${c3}`)
      }
    }
    lines.push('')
  }
  let block = lines.join('\n').trim()
  let truncated = false
  if (block.length > MAX_BLOCK_CHARS) {
    block = block.slice(0, MAX_BLOCK_CHARS)
    const cut = block.lastIndexOf('\n')
    if (cut > 0) block = block.slice(0, cut)
    truncated = true
  }
  return { block, truncated }
}

function normLabel(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function resolveTripleFromTaxonomy(cat1: string, cat2: string, cat3: string, triples: Triple[]): Triple | null {
  const n1 = normLabel(cat1)
  const n2 = normLabel(cat2)
  const n3 = normLabel(cat3)
  if (!(n1 && n2 && n3)) return null
  return (
    triples.find(
      (t) =>
        normLabel(t.cat1).toLowerCase() === n1.toLowerCase() &&
        normLabel(t.cat2).toLowerCase() === n2.toLowerCase() &&
        normLabel(t.cat3).toLowerCase() === n3.toLowerCase()
    ) ?? null
  )
}

function filterTriplesByGenderHint(triples: Triple[], hint: 'female' | 'male' | null): Triple[] {
  if (!hint || !triples.length) return triples
  const out = triples.filter((t) => {
    if (hint === 'female' && cat1IsGenderedMale(t.cat1)) return false
    if (hint === 'male' && cat1IsGenderedFemale(t.cat1)) return false
    return true
  })
  return out.length ? out : triples
}

function buildTaxonomyContextBlob(productData: Record<string, unknown>): string {
  const parts: string[] = []
  const cn = nonemptyField(productData, 'chinese_name')
  const vi = nonemptyField(productData, 'name')
  if (cn) parts.push(`Tên tiếng Trung (nguồn phân loại): ${cn}`)
  if (vi && vi !== cn) parts.push(`Tên tiếng Việt (tham khảo): ${vi}`)
  const d = str(productData.description)
  if (d) parts.push(d)
  for (const key of [
    'material',
    'style',
    'color',
    'occasion',
    'features',
    'weight',
  ]) {
    const val = productData[key]
    if (val == null) continue
    const text = Array.isArray(val) || (val && typeof val === 'object') ? JSON.stringify(val) : str(val)
    if (scrubPlaceholder(text)) parts.push(`${key}: ${text}`)
  }
  const pi = asRecord(productData.product_info)
  if (pi) {
    const spec = asRecord(pi.specifications)
    if (spec) {
      const excerpt = str(spec.supplier_specs_excerpt)
      if (excerpt && excerpt !== d) parts.push(excerpt.slice(0, 4000))
    }
  }
  return parts.join('\n\n').trim().slice(0, MAX_CONTEXT_CHARS)
}

function ensureInner(productData: Record<string, unknown>): Record<string, unknown> {
  const pi = asRecord(productData.product_info) ?? {}
  productData.product_info = pi
  const inner = asRecord(pi.product_info) ?? {}
  pi.product_info = inner
  return inner
}

function mergeVietnameseDisplay(productData: Record<string, unknown>, baseVi: string, displayVi: string): void {
  const inner = ensureInner(productData)
  inner.name_vi = baseVi
  inner.display_name_vi = displayVi
}

function mergeMaterialVi(productData: Record<string, unknown>, materialVi: string): void {
  let mv = scrubCjk(materialVi).trim()
  if (hasCjk(mv)) mv = ''
  if (mv.length > 100) mv = mv.slice(0, 100).trim()
  const inner = ensureInner(productData)
  if (mv) {
    productData.material = mv
    inner.material_vi = mv
    return
  }
  if (hasCjk(str(productData.material))) productData.material = ''
  const kept = viOrEmpty(productData.material)
  if (kept) inner.material_vi = kept
  else delete inner.material_vi
}

function mergeDescriptionVi(productData: Record<string, unknown>, moTaVi: string): void {
  let md = scrubCjk(moTaVi).trim()
  if (!md) return
  if (md.length > 12000) md = md.slice(0, 12000).trim()
  productData.description = md
  const inner = ensureInner(productData)
  inner.description_vi_generated = true
}

function viOrEmpty(raw: unknown): string {
  const s = scrubPlaceholder(scrubCjk(str(raw)))
  return hasCjk(s) ? '' : s
}

function sizesJoinVi(productData: Record<string, unknown>): string {
  let raw: unknown = productData.sizes
  if (raw == null || (typeof raw === 'string' && !String(raw).trim())) {
    const pi = asRecord(productData.product_info)
    const variants = asRecord(pi?.variants)
    if (variants?.sizes != null) raw = variants.sizes
  }
  if (raw == null) return ''
  if (typeof raw === 'string') return scrubPlaceholder(raw)
  if (Array.isArray(raw)) {
    return raw.map((x) => scrubPlaceholder(String(x))).filter(Boolean).join(', ')
  }
  return scrubPlaceholder(String(raw))
}

function mergeExcelWebListingBlocks(productData: Record<string, unknown>, triple: Triple): void {
  const inner = ensureInner(productData)
  const pi = asRecord(productData.product_info)!
  const code = scrubPlaceholder(str(productData.code || productData.sku))
  if (code) inner.sku = code
  else delete inner.sku
  const nameDisp = scrubPlaceholder(str(productData.name))
  if (nameDisp) inner.name = nameDisp
  else delete inner.name

  inner.category = { level_1: triple.cat1, level_2: triple.cat2, level_3: triple.cat3 }

  const specExisting = asRecord(pi.specifications) ?? {}
  const spec: Record<string, unknown> = { ...specExisting }

  const mat = viOrEmpty(triple.chat_lieu_vi) || viOrEmpty(productData.material) || viOrEmpty(inner.material_vi)
  if (mat) {
    spec.upper_material = mat
    if (!viOrEmpty(productData.material)) productData.material = mat.slice(0, 100)
  } else {
    delete spec.upper_material
    if (hasCjk(str(productData.material))) productData.material = ''
  }

  const styleV = viOrEmpty(triple.phong_cach_vi) || viOrEmpty(productData.style)
  if (styleV) {
    spec.style = styleV
    productData.style = styleV.slice(0, 100)
  } else {
    delete spec.style
    productData.style = ''
  }

  const dipV = viOrEmpty(triple.dip_vi) || viOrEmpty(productData.occasion)
  if (dipV) {
    spec.occasion = dipV
    productData.occasion = dipV.slice(0, 100)
  } else {
    delete spec.occasion
    productData.occasion = ''
  }

  const tw = viOrEmpty(triple.trong_luong_vi) || viOrEmpty(productData.weight)
  if (tw) spec.weight_note_vi = tw
  else delete spec.weight_note_vi

  const got = viOrEmpty(triple.chieu_cao_got_vi)
  if (got) spec.heel_height = got
  else delete spec.heel_height

  const tsDims = viOrEmpty(triple.thong_so_kich_thuoc_vi)
  if (tsDims) spec.thong_so_kich_thuoc_vi = tsDims
  else delete spec.thong_so_kich_thuoc_vi

  pi.specifications = spec

  const colorsJoin = collectListingImportColorLabels(productData).join(', ')
  const sizesJoin = sizesJoinVi(productData)
  const varExisting = asRecord(pi.variants) ?? {}
  const varM: Record<string, unknown> = { ...varExisting }
  if (colorsJoin) {
    varM.colors = colorsJoin
    productData.color = colorsJoin.slice(0, 500)
  } else {
    delete varM.colors
  }
  if (sizesJoin) varM.sizes = sizesJoin
  pi.variants = varM

  const kh = viOrEmpty(triple.khach_hang)
  if (kh) {
    inner.target_audience_suggestion_vi = kh
    const meta = asRecord(pi.import_taxonomy_meta) ?? {}
    meta.khach_hang_vi = kh
    pi.import_taxonomy_meta = meta
  }
}

function applyViNameAndDesc(productData: Record<string, unknown>, tenVi: string, moTaVi: string): void {
  if (moTaVi) mergeDescriptionVi(productData, moTaVi)
  if (!tenVi) return
  const labs = collectListingImportColorLabels(productData)
  const disp = appendListingImportColorSuffixToViName(tenVi, labs)
  mergeVietnameseDisplay(productData, tenVi, disp)
  const viDisplay = (disp || tenVi).trim()
  if (viDisplay) productData.name = viDisplay.slice(0, 500)
}

function shouldSkipExisting(productData: Record<string, unknown>): boolean {
  return Boolean(
    nonemptyField(productData, 'category') &&
      nonemptyField(productData, 'subcategory') &&
      nonemptyField(productData, 'sub_subcategory')
  )
}

async function translateListingViOnly(
  productName: string,
  supplierDescription: string,
  contextText: string,
  descriptionOnly: boolean
): Promise<{ ten: string; moTa: string }> {
  const name = productName.trim()
  const desc = supplierDescription.trim()
  const blob = contextText.trim().slice(0, MAX_CONTEXT_CHARS)
  if (!name && !desc && !blob) return { ten: '', moTa: '' }
  const user = descriptionOnly
    ? `NHIỆM VỤ: Chỉ viết mo_ta_vi.\n- JSON 2 key: ten_tieng_viet="" và mo_ta_vi.\n- mo_ta_vi: tiếng Việt 350–1200 ký tự, 2–5 đoạn.\n${LISTING_SANITIZE_PROMPT_VI}\nTÊN:\n${name}\n\nMÔ TẢ / THÔNG SỐ:\n${(desc + '\n' + blob).trim()}\n`
    : `NHIỆM VỤ: Tên và mô tả tiếng Việt.\n- ten_tieng_viet ≤220 ký tự, không liệt kê hết màu/size.\n- mo_ta_vi: 350–1200 ký tự, 2–5 đoạn.\n${LISTING_SANITIZE_PROMPT_VI}\nNGỮ CẢNH:\n${blob}\n\nTÊN NGUỒN:\n${name}\n\nMÔ TẢ NGUỒN:\n${desc}\n`
  const r = await deepseekPartnerChat(
    'Bạn dịch / viết lại tin đăng sản phẩm thương mại điện tử sang tiếng Việt tự nhiên. Đầu ra: DUY NHẤT một JSON, không CJK.',
    user,
    { feature: 'listing-import-translate', userId: null }
  )
  if (r.error || !r.text) return { ten: '', moTa: '' }
  const parsed = extractListingImportJsonObject(r.text)
  if (!parsed) return { ten: '', moTa: '' }
  const ten = descriptionOnly ? '' : scrubCjk(str(parsed.ten_tieng_viet)).slice(0, 220)
  let moTa = scrubCjk(str(parsed.mo_ta_vi))
  moTa = moTa.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { ten, moTa }
}

async function classifyTaxonomyDeepseek(input: {
  title: string
  contextText: string
  triples: Triple[]
  genderHint: 'female' | 'male' | null
  warnings: string[]
  allowCreate: boolean
}): Promise<Triple | null> {
  const name = input.title.trim()
  if (!name) {
    input.warnings.push('deepseek_taxonomy: tên sản phẩm trống.')
    return null
  }
  const triplesUse = filterTriplesByGenderHint(input.triples, input.genderHint)
  if (!input.allowCreate && triplesUse.length === 0) {
    input.warnings.push('deepseek_taxonomy: cây trống — tắt tự tạo nên không phân loại.')
    return null
  }
  const { block, truncated } = triplesUse.length
    ? buildTaxonomyPromptBlock(triplesUse)
    : {
        block: '(Chưa có taxonomy trong DB. Đề xuất cat1/cat2/cat3 tiếng Việt ngắn, đúng ngành hàng thương mại VN.)',
        truncated: false,
      }
  if (truncated) {
    input.warnings.push('deepseek_taxonomy: bảng danh mục quá dài — đã cắt bớt phần cuối trong prompt.')
  }
  let genderLines = ''
  if (input.genderHint === 'female') {
    genderLines =
      '\nRÀNG BUỘC GIỚI: Sản phẩm dành cho **NỮ**. Không chọn cat1 kết thúc bằng « Nam ».\n'
  } else if (input.genderHint === 'male') {
    genderLines =
      '\nRÀNG BUỘC GIỚI: Sản phẩm dành cho **NAM**. Không chọn cat1 kết thúc « Nữ ».\n'
  }
  const ctxBlock = input.contextText.trim()
    ? `NGỮ CẢNH MÔ TẢ / THÔNG SỐ:\n${input.contextText.trim()}\n\n`
    : ''
  const system = `Bạn là chuyên gia phân loại sản phẩm thương mại điện tử Việt Nam.\n\n${TAXONOMY_CLASSIFICATION_RULES_VI.trim()}\nKhông dùng markdown; không giải thích ngoài JSON.`
  const user =
    `BẢNG DANH MỤC (mỗi ## là cat1; dòng «cat2 > cat3» là một nhánh hợp lệ):\n\n${block}\n\n` +
    `${genderLines}${ctxBlock}` +
    `TÊN SẢN PHẨM (ưu tiên tiếng Trung / tên NCC gốc):\n${name}\n\n` +
    `${taxonomyNoMatchPromptLine(input.allowCreate)}\n` +
    'Trả về DUY NHẤT một JSON đủ 14 key:\n' +
    '{"cat1":"...","cat2":"...","cat3":"...","khach_hang":"...","ten_tieng_viet":"...","chat_lieu_vi":"","mo_ta_vi":"...","thuong_hieu_vi":"","xuat_xu_vi":"","phong_cach_vi":"","dip_vi":"","trong_luong_vi":"","chieu_cao_got_vi":"","thong_so_kich_thuoc_vi":""}'

  const r = await deepseekPartnerChat(system, user, { feature: 'listing-import-taxonomy', userId: null })
  if (r.error) {
    input.warnings.push(`deepseek_taxonomy: ${r.error}`)
    return null
  }
  const parsed = extractListingImportJsonObject(r.text || '')
  if (!parsed) {
    input.warnings.push('deepseek_taxonomy: không đọc được JSON từ model.')
    return null
  }
  const c1 = str(parsed.cat1)
  const c2 = str(parsed.cat2)
  const c3 = str(parsed.cat3)
  if (!(c1 && c2 && c3)) {
    input.warnings.push('deepseek_taxonomy: model trả thiếu cat1/cat2/cat3.')
    return null
  }
  if (hasCjk(c1 + c2 + c3)) {
    input.warnings.push('deepseek_taxonomy: cat1–cat3 chứa ký tự CJK — bỏ qua.')
    return null
  }
  const ten = scrubCjk(str(parsed.ten_tieng_viet)).slice(0, 220)
  return {
    cat1: c1,
    cat2: c2,
    cat3: c3,
    khach_hang: viOrEmpty(parsed.khach_hang),
    ten_tieng_viet: ten,
    chat_lieu_vi: viOrEmpty(parsed.chat_lieu_vi).slice(0, 100),
    mo_ta_vi: scrubCjk(str(parsed.mo_ta_vi)),
    thuong_hieu_vi: viOrEmpty(parsed.thuong_hieu_vi),
    xuat_xu_vi: viOrEmpty(parsed.xuat_xu_vi),
    phong_cach_vi: viOrEmpty(parsed.phong_cach_vi),
    dip_vi: viOrEmpty(parsed.dip_vi),
    trong_luong_vi: viOrEmpty(parsed.trong_luong_vi),
    chieu_cao_got_vi: viOrEmpty(parsed.chieu_cao_got_vi),
    thong_so_kich_thuoc_vi: viOrEmpty(parsed.thong_so_kich_thuoc_vi),
  }
}

/**
 * Phân loại DeepSeek 14 key + gắn L1/L2/L3 + SEO — khớp 188 apply_deepseek_taxonomy_to_product_data.
 * Tắt tự tạo: khớp nhánh đã có thì dùng; không khớp mới lỗi + hướng dẫn bật công tắc.
 */
export async function applyListingImportTaxonomy(
  partnerId: string,
  productData: Record<string, unknown>,
  warnings: string[],
  opts?: { allowCreate?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const allowCreate =
    typeof opts?.allowCreate === 'boolean'
      ? opts.allowCreate
      : await fetchPartnerAllowAutoCreateCategoriesFromPg(partnerId)
  const titleSrc = nonemptyField(productData, 'chinese_name') || nonemptyField(productData, 'name')
  const descSrc = str(productData.description)
  const ctx = buildTaxonomyContextBlob(productData)
  const nameVi = nonemptyField(productData, 'name')

  if (shouldSkipExisting(productData)) {
    if (!allowCreate) {
      const exists = await existingPartnerCategoryTripleExists(
        partnerId,
        str(productData.category),
        str(productData.subcategory),
        str(productData.sub_subcategory)
      )
      if (!exists) {
        warnings.push(`deepseek_taxonomy: ${CATEGORY_AUTO_CREATE_DISABLED} — danh mục nháp không có trên cây.`)
        productData._taxonomy_error = CATEGORY_AUTO_CREATE_DISABLED
        return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
      }
    }
    const { ten, moTa } = await translateListingViOnly(nameVi || titleSrc, descSrc, ctx, false)
    if (ten || moTa) applyViNameAndDesc(productData, ten, moTa)
    warnings.push('deepseek_taxonomy: giữ nguyên danh mục đã có — đã cập nhật tên/mô tả tiếng Việt (nếu API trả được).')
    return { ok: true }
  }

  if (!titleSrc) {
    warnings.push('taxonomy: thiếu tên — bỏ qua phân loại.')
    if (!allowCreate) {
      productData._taxonomy_error = CATEGORY_AUTO_CREATE_DISABLED
      return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
    }
    return { ok: true }
  }

  const tree = (await fetchPartnerCategoriesFlatFromPg(partnerId)) ?? []
  const triples = loadActiveCategoryTriples(tree)
  const genderHint = inferListingImportSupplierGenderHint(`${titleSrc}\n${nameVi}\n${ctx}`)

  const classified = await classifyTaxonomyDeepseek({
    title: titleSrc,
    contextText: ctx,
    triples,
    genderHint,
    warnings,
    allowCreate,
  })

  if (!classified) {
    const { ten, moTa } = await translateListingViOnly(nameVi || titleSrc, descSrc, ctx, false)
    if (ten || moTa) applyViNameAndDesc(productData, ten, moTa)
    warnings.push('deepseek_listing_translate: taxonomy không gán được nhánh — chỉ cập nhật tên/mô tả tiếng Việt nếu có.')
    if (!allowCreate) {
      productData._taxonomy_error = CATEGORY_AUTO_CREATE_DISABLED
      return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
    }
    return { ok: true }
  }

  if (!allowCreate && !resolveTripleFromTaxonomy(classified.cat1, classified.cat2, classified.cat3, triples)) {
    warnings.push(`deepseek_taxonomy: ${CATEGORY_AUTO_CREATE_DISABLED} — model không khớp nhánh đã có.`)
    productData._taxonomy_error = CATEGORY_AUTO_CREATE_DISABLED
    return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
  }

  const placed = await ensurePartnerCategoryTripleWithSeo({
    partnerId,
    categoryL1: classified.cat1,
    categoryL2: classified.cat2,
    categoryL3: classified.cat3,
    productName: classified.ten_tieng_viet || nameVi || titleSrc,
    allowCreate,
  })
  warnings.push(...placed.warnings)
  if (!placed.ok) {
    warnings.push(`deepseek_taxonomy: không tạo/gán được danh mục (${placed.error || 'unknown'}).`)
    const { ten, moTa } = await translateListingViOnly(nameVi || titleSrc, descSrc, ctx, false)
    if (ten || moTa) applyViNameAndDesc(productData, ten, moTa)
    if (!allowCreate) {
      productData._taxonomy_error = placed.error || CATEGORY_AUTO_CREATE_DISABLED
      return { ok: false, error: placed.error || CATEGORY_AUTO_CREATE_DISABLED }
    }
    return { ok: true }
  }

  delete productData._taxonomy_auto_created_levels
  delete productData._taxonomy_error
  productData.category = placed.cat1
  productData.subcategory = placed.cat2
  productData.sub_subcategory = placed.cat3
  if (placed.createdLevels) productData._taxonomy_auto_created_levels = placed.createdLevels
  if (placed.fullSlug) productData.slug_seo = placed.fullSlug

  const canon: Triple = {
    ...classified,
    cat1: placed.cat1,
    cat2: placed.cat2,
    cat3: placed.cat3,
    full_slug: placed.fullSlug,
    created_levels: placed.createdLevels,
  }

  mergeMaterialVi(productData, str(canon.chat_lieu_vi))
  mergeDescriptionVi(productData, str(canon.mo_ta_vi))
  let tenVi = str(canon.ten_tieng_viet)
  if (!tenVi) {
    const fbName = await translateListingViOnly(nameVi || titleSrc, descSrc, ctx, false)
    tenVi = fbName.ten
    if (fbName.moTa && !str(canon.mo_ta_vi)) mergeDescriptionVi(productData, fbName.moTa)
  }
  if (tenVi) applyViNameAndDesc(productData, tenVi, '')
  if (!str(canon.mo_ta_vi) && str(productData.description)) {
    const fb = await translateListingViOnly(str(productData.name) || titleSrc, str(productData.description), ctx, true)
    if (fb.moTa) mergeDescriptionVi(productData, fb.moTa)
  }
  mergeExcelWebListingBlocks(productData, canon)
  return { ok: true }
}

/**
 * Optional: khi tắt tự tạo, thử khớp tiêu đề overlay với cây trước Playwright.
 * Không khớp → caller có thể bỏ scrape dòng đó. Enqueue không dùng hàm này để chặn cả đợt.
 */
export async function previewListingImportTaxonomyMatch(input: {
  partnerId: string
  title: string
  allowCreate?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowCreate =
    typeof input.allowCreate === 'boolean'
      ? input.allowCreate
      : await fetchPartnerAllowAutoCreateCategoriesFromPg(input.partnerId)
  if (allowCreate) return { ok: true }
  const title = input.title.trim()
  if (!title) return { ok: true }

  const warnings: string[] = []
  const tree = (await fetchPartnerCategoriesFlatFromPg(input.partnerId)) ?? []
  const triples = loadActiveCategoryTriples(tree)
  const genderHint = inferListingImportSupplierGenderHint(title)
  const classified = await classifyTaxonomyDeepseek({
    title,
    contextText: '',
    triples,
    genderHint,
    warnings,
    allowCreate: false,
  })
  if (!classified) return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
  if (!resolveTripleFromTaxonomy(classified.cat1, classified.cat2, classified.cat3, triples)) {
    return { ok: false, error: CATEGORY_AUTO_CREATE_DISABLED }
  }
  return { ok: true }
}
