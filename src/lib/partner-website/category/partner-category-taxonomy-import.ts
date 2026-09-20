/**
 * Import cây danh mục taxonomy — cùng file 4 sheet `taxonomy_import.xlsx` của 188.com.vn.
 *
 * Upsert theo cột `id` (external_id): đã có → cập nhật; chưa có → thêm.
 * Import lặp lại không xóa nhánh chỉ vì thiếu trong file.
 * Storefront vẫn `/c/{l1}/{l2}/{l3}` — không copy cluster 301.
 */
import * as XLSX from 'xlsx'
import {
  isValidPartnerCategorySlug,
  slugifyPartnerCategoryName,
} from '@/lib/partner-website/category/partner-category-types'

export const TAXONOMY_REQUIRED_SHEETS = ['categories', 'category_paths', 'seo_clusters', 'meta'] as const

export const TAXONOMY_CATEGORY_COLUMNS = [
  'id',
  'parent_id',
  'level',
  'name',
  'slug',
  'full_slug',
  'sort_order',
  'is_active',
  'seo_index',
  'seo_cluster_id',
] as const

export const TAXONOMY_CLUSTER_COLUMNS = [
  'id',
  'slug',
  'name',
  'canonical_path',
  'index_policy',
  'source',
  'notes',
] as const

export const TAXONOMY_CATEGORY_PATH_COLUMNS = [
  'cat1_id',
  'cat1_name',
  'cat1_slug',
  'cat2_id',
  'cat2_name',
  'cat2_slug',
  'cat3_id',
  'cat3_name',
  'cat3_slug',
  'full_slug',
  'seo_cluster_id',
  'seo_cluster_slug',
] as const

export type TaxonomySheetName = (typeof TAXONOMY_REQUIRED_SHEETS)[number]

export type TaxonomySheetRow = Record<string, string>

export type TaxonomyParsedSheets = Record<TaxonomySheetName, TaxonomySheetRow[]>

export type TaxonomyUpsertCounts = { inserted: number; updated: number }

export type TaxonomyImportSummary = {
  ok: true
  summary: {
    categories: {
      '1': TaxonomyUpsertCounts
      '2': TaxonomyUpsertCounts
      '3': TaxonomyUpsertCounts
    }
    clusters: TaxonomyUpsertCounts & { in_database_after: number }
  }
  errors: {
    seo_clusters: string[]
    categories: string[]
    category_paths: string[]
  }
  meta: Record<string, string>
  elapsed_ms: number
}

export type TaxonomyClusterDraft = {
  externalId: string
  slug: string
  name: string
  canonicalPath: string
  indexPolicy: 'index' | 'noindex'
  source: string
  notes: string | null
}

export type TaxonomyCategoryDraft = {
  excelRow: number
  externalId: string
  parentExternalId: string
  level: 1 | 2 | 3
  name: string
  slug: string
  fullSlug: string
  sortOrder: number
  isActive: boolean
  seoIndex: boolean
  clusterExternalId: string
}

export type TaxonomyParseOk = {
  ok: true
  sheets: TaxonomyParsedSheets
  clusters: TaxonomyClusterDraft[]
  categories: TaxonomyCategoryDraft[]
  pathErrors: string[]
  clusterErrors: string[]
  categoryErrors: string[]
  meta: Record<string, string>
}

export type TaxonomyParseFail = { ok: false; error: string }

export type TaxonomyManualUpsertInput = {
  cat1ExistingExternalId?: string | null
  cat1Name?: string | null
  cat1Slug?: string | null
  cat2ExistingExternalId?: string | null
  cat2Name?: string | null
  cat2Slug?: string | null
  cat3Name: string
  cat3Slug?: string | null
  clusterExistingExternalId?: string | null
  clusterName?: string | null
  clusterSlug?: string | null
  clusterIndexPolicy?: 'index' | 'noindex'
  cat3SeoIndex?: 'index' | 'noindex'
  cat3SortOrder?: number
  isActive?: boolean
}

export type TaxonomyManualResolved = {
  sheets: TaxonomyParsedSheets
  cat1ExternalId: string
  cat2ExternalId: string
  cat3ExternalId: string
  clusterExternalId: string
}

function cell(row: Record<string, unknown>, key: string): string {
  const direct = row[key]
  if (direct != null && String(direct).trim() !== '') return String(direct).trim()
  const want = key.trim().toLowerCase()
  for (const [k, v] of Object.entries(row)) {
    if (k.trim().toLowerCase() === want) return v == null ? '' : String(v).trim()
  }
  return ''
}

function sheetToRows(wb: XLSX.WorkBook, name: string): TaxonomySheetRow[] | null {
  const found = wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase())
  if (!found) return null
  const sheet = wb.Sheets[found]
  if (!sheet) return null
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  return raw.map((row) => {
    const out: TaxonomySheetRow = {}
    for (const [k, v] of Object.entries(row)) {
      out[String(k).trim()] = v == null ? '' : String(v).trim()
    }
    return out
  })
}

export function truthyActive(val: string): boolean {
  const s = val.trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

export function truthyIndex(val: string): boolean {
  return val.trim().toLowerCase() === 'index'
}

export function safeInt(val: string, fallback = 0): number {
  const n = Number.parseInt(String(val).trim() || String(fallback), 10)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeImportedSlug(userSlug: string, name: string): { slug: string; warned: boolean } {
  const raw = userSlug.trim().toLowerCase()
  if (raw && isValidPartnerCategorySlug(raw)) return { slug: raw, warned: false }
  const fromRaw = raw ? slugifyPartnerCategoryName(raw) : ''
  const slug = isValidPartnerCategorySlug(fromRaw) ? fromRaw : slugifyPartnerCategoryName(name)
  return { slug, warned: Boolean(raw) && slug !== raw }
}

function indexPolicyOf(val: string): 'index' | 'noindex' {
  return val.trim().toLowerCase() === 'noindex' ? 'noindex' : 'index'
}

export function draftsFromTaxonomySheets(sheets: TaxonomyParsedSheets): Omit<TaxonomyParseOk, 'ok' | 'sheets'> & {
  sheets: TaxonomyParsedSheets
} {
  const clusterErrors: string[] = []
  const clusters: TaxonomyClusterDraft[] = []
  const seenCluster = new Set<string>()
  sheets.seo_clusters.forEach((row, i) => {
    const excelRow = i + 2
    const externalId = cell(row, 'id')
    if (!externalId) {
      clusterErrors.push(`seo_clusters row ${excelRow}: thiếu cột id`)
      return
    }
    const slugRaw = cell(row, 'slug')
    const name = cell(row, 'name')
    if (!slugRaw || !name) {
      clusterErrors.push(`seo_clusters row ${excelRow}: thiếu slug hoặc name`)
      return
    }
    const { slug } = normalizeImportedSlug(slugRaw, name)
    if (!slug) {
      clusterErrors.push(`seo_clusters row ${excelRow}: slug không hợp lệ`)
      return
    }
    if (seenCluster.has(externalId)) {
      clusterErrors.push(`seo_clusters row ${excelRow}: trùng id ${externalId}`)
      return
    }
    seenCluster.add(externalId)
    clusters.push({
      externalId: externalId.slice(0, 200),
      slug: slug.slice(0, 300),
      name: name.slice(0, 500),
      canonicalPath: (cell(row, 'canonical_path') || `/c/${slug}`).slice(0, 500),
      indexPolicy: indexPolicyOf(cell(row, 'index_policy') || 'index'),
      source: (cell(row, 'source') || 'auto_from_cat3').slice(0, 50) || 'auto_from_cat3',
      notes: cell(row, 'notes') || null,
    })
  })

  const categoryErrors: string[] = []
  const categories: TaxonomyCategoryDraft[] = []
  const seenCat = new Set<string>()
  sheets.categories.forEach((row, i) => {
    const excelRow = i + 2
    const externalId = cell(row, 'id')
    if (!externalId) {
      categoryErrors.push(`categories row ${excelRow}: thiếu id`)
      return
    }
    const level = safeInt(cell(row, 'level'), 0)
    if (level !== 1 && level !== 2 && level !== 3) {
      categoryErrors.push(`categories row ${excelRow} (${externalId}): level không hợp lệ (${cell(row, 'level')})`)
      return
    }
    const name = cell(row, 'name')
    const slugIn = cell(row, 'slug')
    const fullSlugIn = cell(row, 'full_slug')
    if (!name || !slugIn || !fullSlugIn) {
      categoryErrors.push(`categories row ${excelRow} (${externalId}): thiếu name/slug/full_slug`)
      return
    }
    const { slug, warned } = normalizeImportedSlug(slugIn, name)
    if (!slug) {
      categoryErrors.push(`categories row ${excelRow} (${externalId}): slug không hợp lệ`)
      return
    }
    if (warned) {
      categoryErrors.push(`categories row ${excelRow} (${externalId}): slug đã chuẩn hoá thành ${slug}`)
    }
    const fullSlug = fullSlugIn
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .map((part) => slugifyPartnerCategoryName(part) || part)
      .filter(Boolean)
      .join('/')
    if (!fullSlug) {
      categoryErrors.push(`categories row ${excelRow} (${externalId}): full_slug không hợp lệ`)
      return
    }
    if (seenCat.has(externalId)) {
      categoryErrors.push(`categories row ${excelRow}: trùng id ${externalId}`)
      return
    }
    seenCat.add(externalId)
    categories.push({
      excelRow,
      externalId: externalId.slice(0, 200),
      parentExternalId: cell(row, 'parent_id').slice(0, 200),
      level,
      name: name.slice(0, 200),
      slug: slug.slice(0, 100),
      fullSlug: fullSlug.slice(0, 600),
      sortOrder: safeInt(cell(row, 'sort_order'), 0),
      isActive: truthyActive(cell(row, 'is_active')),
      seoIndex: truthyIndex(cell(row, 'seo_index')),
      clusterExternalId: cell(row, 'seo_cluster_id').slice(0, 200),
    })
  })
  categories.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder || a.excelRow - b.excelRow)

  const clusterIds = new Set(clusters.map((c) => c.externalId))
  const catIds = new Set(categories.map((c) => c.externalId))
  const pathErrors: string[] = []
  sheets.category_paths.forEach((row, i) => {
    const excelRow = i + 2
    const cat3 = cell(row, 'cat3_id')
    if (cat3 && !catIds.has(cat3)) {
      pathErrors.push(`category_paths row ${excelRow}: cat3_id=${cat3} không có trong sheet categories`)
    }
    const cluster = cell(row, 'seo_cluster_id')
    if (cluster && !clusterIds.has(cluster)) {
      pathErrors.push(`category_paths row ${excelRow}: seo_cluster_id=${cluster} không có trong sheet seo_clusters`)
    }
  })

  const meta: Record<string, string> = {}
  for (const row of sheets.meta) {
    const k = cell(row, 'key')
    const v = cell(row, 'value')
    if (k) meta[k] = v
  }

  return {
    sheets,
    clusters,
    categories,
    pathErrors,
    clusterErrors,
    categoryErrors,
    meta,
  }
}

export function parseTaxonomyWorkbook(fileBytes: Buffer): TaxonomyParseOk | TaxonomyParseFail {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(fileBytes, { type: 'buffer', cellDates: false })
  } catch {
    return { ok: false, error: 'Chỉ chấp nhận file .xlsx hoặc .xls' }
  }

  const missing = TAXONOMY_REQUIRED_SHEETS.filter((name) => sheetToRows(wb, name) == null)
  if (missing.length) {
    return {
      ok: false,
      error: `File thiếu sheet bắt buộc: ${missing.join(', ')}. Có: ${wb.SheetNames.join(', ')}`,
    }
  }

  const sheets: TaxonomyParsedSheets = {
    categories: sheetToRows(wb, 'categories') ?? [],
    category_paths: sheetToRows(wb, 'category_paths') ?? [],
    seo_clusters: sheetToRows(wb, 'seo_clusters') ?? [],
    meta: sheetToRows(wb, 'meta') ?? [],
  }
  return { ok: true, ...draftsFromTaxonomySheets(sheets) }
}

function categoryRowDict(input: {
  id: string
  parentId: string
  level: number
  name: string
  slug: string
  fullSlug: string
  sortOrder: number
  isActive: boolean
  seoIndexLit: string
  clusterExt: string
}): TaxonomySheetRow {
  return {
    id: input.id,
    parent_id: input.parentId,
    level: String(input.level),
    name: input.name,
    slug: input.slug,
    full_slug: input.fullSlug,
    sort_order: String(input.sortOrder),
    is_active: input.isActive ? '1' : '0',
    seo_index: input.seoIndexLit,
    seo_cluster_id: input.clusterExt,
  }
}

export function emptyTaxonomyImportSummary(elapsedMs = 0): TaxonomyImportSummary {
  return {
    ok: true,
    summary: {
      categories: {
        '1': { inserted: 0, updated: 0 },
        '2': { inserted: 0, updated: 0 },
        '3': { inserted: 0, updated: 0 },
      },
      clusters: { inserted: 0, updated: 0, in_database_after: 0 },
    },
    errors: { seo_clusters: [], categories: [], category_paths: [] },
    meta: {},
    elapsed_ms: elapsedMs,
  }
}

export function buildManualTaxonomySheets(input: {
  body: TaxonomyManualUpsertInput
  existingCat1?: { externalId: string; name: string; slug: string; level: number } | null
  existingCat2?: { externalId: string; name: string; slug: string; level: number; parentExternalId: string } | null
  existingCluster?: { externalId: string; slug: string; name: string } | null
}): TaxonomyManualResolved {
  const body = input.body
  const isActive = body.isActive !== false
  const cat3SeoIndex = body.cat3SeoIndex === 'noindex' ? 'noindex' : 'index'
  const cat3SortOrder = Number.isFinite(body.cat3SortOrder) ? Number(body.cat3SortOrder) : 0

  const catRows: TaxonomySheetRow[] = []
  let cat1Name: string
  let cat1Slug: string
  let cat1Ext: string

  if (body.cat1ExistingExternalId?.trim()) {
    const c1 = input.existingCat1
    if (!c1 || c1.level !== 1) throw new Error('Cấp 1 (external_id) không tồn tại hoặc không phải level 1')
    cat1Ext = c1.externalId
    cat1Name = c1.name
    cat1Slug = c1.slug
  } else {
    const name = (body.cat1Name || '').trim()
    if (!name) throw new Error('Thiếu tên cấp 1 hoặc chọn cấp 1 có sẵn')
    cat1Slug = normalizeImportedSlug(body.cat1Slug || '', name).slug
    if (!cat1Slug) throw new Error('Slug cấp 1 không hợp lệ')
    cat1Name = name
    cat1Ext = `cat1__${cat1Slug}`
    catRows.push(
      categoryRowDict({
        id: cat1Ext,
        parentId: '',
        level: 1,
        name: cat1Name,
        slug: cat1Slug,
        fullSlug: cat1Slug,
        sortOrder: 0,
        isActive,
        seoIndexLit: 'index',
        clusterExt: '',
      })
    )
  }

  let cat2Name: string
  let cat2Slug: string
  let cat2Ext: string

  if (body.cat2ExistingExternalId?.trim()) {
    if (!body.cat1ExistingExternalId?.trim()) {
      throw new Error('Chọn cấp 2 có sẵn thì phải chọn cấp 1 có sẵn (không tạo cấp 1 mới + cấp 2 cũ)')
    }
    const c2 = input.existingCat2
    if (!c2 || c2.level !== 2) throw new Error('Cấp 2 không tồn tại hoặc không phải level 2')
    if (c2.parentExternalId !== cat1Ext) throw new Error('Cấp 2 không thuộc cấp 1 đã chọn')
    cat2Ext = c2.externalId
    cat2Name = c2.name
    cat2Slug = c2.slug
  } else {
    const name = (body.cat2Name || '').trim()
    if (!name) throw new Error('Thiếu tên cấp 2 hoặc chọn cấp 2 có sẵn')
    cat2Slug = normalizeImportedSlug(body.cat2Slug || '', name).slug
    if (!cat2Slug) throw new Error('Slug cấp 2 không hợp lệ')
    cat2Name = name
    cat2Ext = `cat2__${cat1Slug}__${cat2Slug}`
    catRows.push(
      categoryRowDict({
        id: cat2Ext,
        parentId: cat1Ext,
        level: 2,
        name: cat2Name,
        slug: cat2Slug,
        fullSlug: `${cat1Slug}/${cat2Slug}`,
        sortOrder: 0,
        isActive,
        seoIndexLit: 'index',
        clusterExt: '',
      })
    )
  }

  const c3name = (body.cat3Name || '').trim()
  if (!c3name) throw new Error('Thiếu tên cấp 3')
  const cat3Slug = normalizeImportedSlug(body.cat3Slug || '', c3name).slug
  if (!cat3Slug) throw new Error('Slug cấp 3 không hợp lệ')
  const cat3Ext = `cat3__${cat1Slug}__${cat2Slug}__${cat3Slug}`

  const clusterRows: TaxonomySheetRow[] = []
  let clusterExt: string
  let clusterSlug: string

  if (body.clusterExistingExternalId?.trim()) {
    const cl = input.existingCluster
    if (!cl) throw new Error('SEO cluster (external_id) không tồn tại')
    clusterExt = cl.externalId
    clusterSlug = cl.slug
  } else {
    const cname = (body.clusterName || '').trim()
    if (!cname) throw new Error('Thiếu tên cluster hoặc chọn cluster có sẵn')
    clusterSlug = normalizeImportedSlug(body.clusterSlug || '', cname).slug
    if (!clusterSlug) throw new Error('Slug cluster không hợp lệ')
    clusterExt = `cluster__${clusterSlug}`
    clusterRows.push({
      id: clusterExt,
      slug: clusterSlug,
      name: cname,
      canonical_path: `/c/${clusterSlug}`,
      index_policy: body.clusterIndexPolicy === 'noindex' ? 'noindex' : 'index',
      source: 'manual_taxonomy_form',
      notes: '',
    })
  }

  catRows.push(
    categoryRowDict({
      id: cat3Ext,
      parentId: cat2Ext,
      level: 3,
      name: c3name,
      slug: cat3Slug,
      fullSlug: `${cat1Slug}/${cat2Slug}/${cat3Slug}`,
      sortOrder: cat3SortOrder,
      isActive,
      seoIndexLit: cat3SeoIndex,
      clusterExt,
    })
  )

  const pathRow: TaxonomySheetRow = {
    cat1_id: cat1Ext,
    cat1_name: cat1Name,
    cat1_slug: cat1Slug,
    cat2_id: cat2Ext,
    cat2_name: cat2Name,
    cat2_slug: cat2Slug,
    cat3_id: cat3Ext,
    cat3_name: c3name,
    cat3_slug: cat3Slug,
    full_slug: `${cat1Slug}/${cat2Slug}/${cat3Slug}`,
    seo_cluster_id: clusterExt,
    seo_cluster_slug: clusterSlug,
  }

  return {
    cat1ExternalId: cat1Ext,
    cat2ExternalId: cat2Ext,
    cat3ExternalId: cat3Ext,
    clusterExternalId: clusterExt,
    sheets: {
      categories: catRows,
      seo_clusters: clusterRows,
      category_paths: [pathRow],
      meta: [{ key: 'manual_form', value: cat3Ext }],
    },
  }
}

function rowsToAoa(rows: TaxonomySheetRow[], columns: readonly string[]): unknown[][] {
  return [columns.slice(), ...rows.map((row) => columns.map((col) => row[col] ?? ''))]
}

export function buildTaxonomyWorkbookBytes(sheets: TaxonomyParsedSheets): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(rowsToAoa(sheets.seo_clusters, TAXONOMY_CLUSTER_COLUMNS)),
    'seo_clusters'
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(rowsToAoa(sheets.categories, TAXONOMY_CATEGORY_COLUMNS)),
    'categories'
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(rowsToAoa(sheets.category_paths, TAXONOMY_CATEGORY_PATH_COLUMNS)),
    'category_paths'
  )
  const metaCols = ['key', 'value']
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsToAoa(sheets.meta, metaCols)), 'meta')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Workbook 4 sheet — đủ cột giống 188 `taxonomy_import_template.xlsx`. */
export function buildStandardTaxonomyTemplateSheets(): TaxonomyParsedSheets {
  const clusters: TaxonomySheetRow[] = [
    {
      id: 'cluster__dep-sandal-nu-quai-ngang',
      slug: 'dep-sandal-nu-quai-ngang',
      name: 'Dép sandal nữ quai ngang',
      canonical_path: '/c/dep-sandal-nu-quai-ngang',
      index_policy: 'index',
      source: 'sample_template',
      notes: 'Xóa/sửa — đây chỉ là ví dụ.',
    },
    {
      id: 'cluster__dep-tong-nu-xop-mot',
      slug: 'dep-tong-nu-xop-mot',
      name: 'Dép tông nữ xốp một',
      canonical_path: '/c/dep-tong-nu-xop-mot',
      index_policy: 'index',
      source: 'sample_template',
      notes: '',
    },
    {
      id: 'cluster__sneaker-giay-bet-nu',
      slug: 'sneaker-giay-bet-nu',
      name: 'Sneaker & giày bệt nữ',
      canonical_path: '/c/sneaker-giay-bet-nu',
      index_policy: 'index',
      source: 'sample_template',
      notes: '',
    },
  ]
  const cats: TaxonomySheetRow[] = [
    {
      id: 'cat1__giay-dep-nu',
      parent_id: '',
      level: '1',
      name: 'Giày dép nữ',
      slug: 'giay-dep-nu',
      full_slug: 'giay-dep-nu',
      sort_order: '1',
      is_active: '1',
      seo_index: 'index',
      seo_cluster_id: '',
    },
    {
      id: 'cat2__giay-dep-nu__dep-sandal-nu',
      parent_id: 'cat1__giay-dep-nu',
      level: '2',
      name: 'Dép sandal Nữ',
      slug: 'dep-sandal-nu',
      full_slug: 'giay-dep-nu/dep-sandal-nu',
      sort_order: '1',
      is_active: '1',
      seo_index: 'index',
      seo_cluster_id: '',
    },
    {
      id: 'cat2__giay-dep-nu__sneaker-giay-bet-nu',
      parent_id: 'cat1__giay-dep-nu',
      level: '2',
      name: 'Sneaker & giày bệt',
      slug: 'sneaker-giay-bet-nu',
      full_slug: 'giay-dep-nu/sneaker-giay-bet-nu',
      sort_order: '2',
      is_active: '1',
      seo_index: 'index',
      seo_cluster_id: '',
    },
    {
      id: 'cat3__giay-dep-nu__dep-sandal-nu__dep-quai-ngang-nu',
      parent_id: 'cat2__giay-dep-nu__dep-sandal-nu',
      level: '3',
      name: 'Dép quai ngang nữ',
      slug: 'dep-quai-ngang-nu',
      full_slug: 'giay-dep-nu/dep-sandal-nu/dep-quai-ngang-nu',
      sort_order: '1',
      is_active: '1',
      seo_index: 'index',
      seo_cluster_id: 'cluster__dep-sandal-nu-quai-ngang',
    },
    {
      id: 'cat3__giay-dep-nu__dep-sandal-nu__dep-tong-nu-xop-mot',
      parent_id: 'cat2__giay-dep-nu__dep-sandal-nu',
      level: '3',
      name: 'Dép tông nữ xốp một',
      slug: 'dep-tong-nu-xop-mot',
      full_slug: 'giay-dep-nu/dep-sandal-nu/dep-tong-nu-xop-mot',
      sort_order: '2',
      is_active: '1',
      seo_index: 'noindex',
      seo_cluster_id: 'cluster__dep-tong-nu-xop-mot',
    },
    {
      id: 'cat3__giay-dep-nu__sneaker-giay-bet-nu__giay-bup-be-nu',
      parent_id: 'cat2__giay-dep-nu__sneaker-giay-bet-nu',
      level: '3',
      name: 'Giày búp bê nữ',
      slug: 'giay-bup-be-nu',
      full_slug: 'giay-dep-nu/sneaker-giay-bet-nu/giay-bup-be-nu',
      sort_order: '1',
      is_active: '1',
      seo_index: 'index',
      seo_cluster_id: 'cluster__sneaker-giay-bet-nu',
    },
  ]
  const paths: TaxonomySheetRow[] = [
    {
      cat1_id: 'cat1__giay-dep-nu',
      cat1_name: 'Giày dép nữ',
      cat1_slug: 'giay-dep-nu',
      cat2_id: 'cat2__giay-dep-nu__dep-sandal-nu',
      cat2_name: 'Dép sandal Nữ',
      cat2_slug: 'dep-sandal-nu',
      cat3_id: 'cat3__giay-dep-nu__dep-sandal-nu__dep-quai-ngang-nu',
      cat3_name: 'Dép quai ngang nữ',
      cat3_slug: 'dep-quai-ngang-nu',
      full_slug: 'giay-dep-nu/dep-sandal-nu/dep-quai-ngang-nu',
      seo_cluster_id: 'cluster__dep-sandal-nu-quai-ngang',
      seo_cluster_slug: 'dep-sandal-nu-quai-ngang',
    },
    {
      cat1_id: 'cat1__giay-dep-nu',
      cat1_name: 'Giày dép nữ',
      cat1_slug: 'giay-dep-nu',
      cat2_id: 'cat2__giay-dep-nu__dep-sandal-nu',
      cat2_name: 'Dép sandal Nữ',
      cat2_slug: 'dep-sandal-nu',
      cat3_id: 'cat3__giay-dep-nu__dep-sandal-nu__dep-tong-nu-xop-mot',
      cat3_name: 'Dép tông nữ xốp một',
      cat3_slug: 'dep-tong-nu-xop-mot',
      full_slug: 'giay-dep-nu/dep-sandal-nu/dep-tong-nu-xop-mot',
      seo_cluster_id: 'cluster__dep-tong-nu-xop-mot',
      seo_cluster_slug: 'dep-tong-nu-xop-mot',
    },
    {
      cat1_id: 'cat1__giay-dep-nu',
      cat1_name: 'Giày dép nữ',
      cat1_slug: 'giay-dep-nu',
      cat2_id: 'cat2__giay-dep-nu__sneaker-giay-bet-nu',
      cat2_name: 'Sneaker & giày bệt',
      cat2_slug: 'sneaker-giay-bet-nu',
      cat3_id: 'cat3__giay-dep-nu__sneaker-giay-bet-nu__giay-bup-be-nu',
      cat3_name: 'Giày búp bê nữ',
      cat3_slug: 'giay-bup-be-nu',
      full_slug: 'giay-dep-nu/sneaker-giay-bet-nu/giay-bup-be-nu',
      seo_cluster_id: 'cluster__sneaker-giay-bet-nu',
      seo_cluster_slug: 'sneaker-giay-bet-nu',
    },
  ]
  return {
    seo_clusters: clusters,
    categories: cats,
    category_paths: paths,
    meta: [
      {
        key: 'template_note',
        value: 'Đây là mẫu đủ cột (category_paths có cat1–cat3 + slug cluster). Xóa ví dụ, thêm dòng thật.',
      },
      { key: 'categories_columns', value: TAXONOMY_CATEGORY_COLUMNS.join(', ') },
      { key: 'category_paths_columns', value: TAXONOMY_CATEGORY_PATH_COLUMNS.join(', ') },
      { key: 'seo_clusters_columns', value: TAXONOMY_CLUSTER_COLUMNS.join(', ') },
      { key: 'external_id', value: 'Cột id trong categories/seo_clusters là external_id — giữ khi re-import.' },
    ],
  }
}

export function buildStandardTaxonomyTemplateBytes(): Buffer {
  return buildTaxonomyWorkbookBytes(buildStandardTaxonomyTemplateSheets())
}

export function sheetsFromParsed(parsed: TaxonomyParseOk): TaxonomyParsedSheets {
  return parsed.sheets
}
