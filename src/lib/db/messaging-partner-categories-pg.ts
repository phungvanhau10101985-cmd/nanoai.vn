import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  buildPartnerCategoryPath,
  buildPartnerCategoryTree,
  isValidPartnerCategorySlug,
  normalizePartnerCategoryI18nMap,
  slugifyPartnerCategoryName,
  PARTNER_CATEGORY_MAX_DEPTH,
  type PartnerCategoryCreateInput,
  type PartnerCategoryNameI18n,
  type PartnerCategoryRow,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'

/**
 * W4.1/W4.2 (nền tảng) + W4.4/W4.5 (Phase 2): CRUD, di chuyển/sắp xếp, gán sản phẩm.
 * Xem docs/188_BEHAVIOR_SPEC.md mục A.8 — CRUD từng node độc lập + kéo-thả sắp xếp thật,
 * KHÔNG copy hạn chế "bắt buộc tạo trọn nhánh, không sửa/xoá được" của 188.
 */

type CategoryDbRow = {
  id: string
  partner_id: string
  parent_id: string | null
  name: string
  name_i18n: unknown
  slug: string
  path: string
  depth: number
  sort_order: number
  is_active: boolean
  image_url: string
  description: string
  description_i18n: unknown
  seo_title: string
  seo_description: string
  seo_index: boolean
  seo_body: string
  seo_body_generated_at: unknown
  seo_body_generated_locale: string | null
  size_guide_image_url: string
  ai_generated: boolean
  created_at: unknown
  updated_at: unknown
}

const SELECT_COLS = `id::text, partner_id::text, parent_id::text, name, name_i18n, slug, path, depth,
  sort_order, is_active, coalesce(image_url, '') as image_url, coalesce(description, '') as description,
  description_i18n, coalesce(seo_title, '') as seo_title, coalesce(seo_description, '') as seo_description,
  seo_index, coalesce(seo_body, '') as seo_body, seo_body_generated_at, seo_body_generated_locale,
  coalesce(size_guide_image_url, '') as size_guide_image_url, coalesce(ai_generated, false) as ai_generated,
  created_at, updated_at`

function mapCategoryRow(r: CategoryDbRow): PartnerCategoryRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    parentId: r.parent_id,
    name: r.name ?? '',
    nameI18n: normalizePartnerCategoryI18nMap(r.name_i18n),
    slug: r.slug,
    path: r.path,
    depth: r.depth,
    sortOrder: r.sort_order ?? 0,
    isActive: r.is_active !== false,
    imageUrl: r.image_url ?? '',
    description: r.description ?? '',
    descriptionI18n: normalizePartnerCategoryI18nMap(r.description_i18n),
    seoTitle: r.seo_title ?? '',
    seoDescription: r.seo_description ?? '',
    seoIndex: r.seo_index !== false,
    seoBody: r.seo_body ?? '',
    seoBodyGeneratedAt: r.seo_body_generated_at ? String(r.seo_body_generated_at) : null,
    seoBodyGeneratedLocale: r.seo_body_generated_locale ?? null,
    sizeGuideImageUrl: r.size_guide_image_url ?? '',
    aiGenerated: r.ai_generated === true,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function isMissingCategoriesTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  if (code !== '42P01') return false
  const msg = String((e as { message?: unknown }).message ?? '')
  return /messaging_partner_categories/i.test(msg)
}

function isUniqueViolation(e: unknown): { constraint: string } | null {
  if (!e || typeof e !== 'object') return null
  const err = e as { code?: string; constraint?: string }
  if (err.code !== '23505') return null
  return { constraint: err.constraint ?? '' }
}

/**
 * Toàn bộ danh mục của 1 shop (mặc định chỉ active), sort theo sort_order.
 * `null` = lỗi/không pool — caller xử lý (vd fallback flat /products theo W4.3).
 */
export async function fetchPartnerCategoriesFlatFromPg(
  partnerId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<PartnerCategoryRow[] | null> {
  if (!isPgConfigured()) return null
  const activeOnly = opts.activeOnly !== false
  try {
    const rows = await pgQuery<CategoryDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_categories
       where partner_id = $1::uuid
         ${activeOnly ? 'and is_active = true' : ''}
       order by depth asc, sort_order asc, name asc`,
      [partnerId]
    )
    return rows.map(mapCategoryRow)
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return []
    console.warn('[fetchPartnerCategoriesFlatFromPg]', e)
    return null
  }
}

/** `true` nếu shop đã có ít nhất 1 danh mục — dùng để quyết định fallback /products phẳng (W4.3). */
export async function hasAnyPartnerCategoriesFromPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ exists: boolean }>(
      `select exists(
         select 1 from public.messaging_partner_categories
         where partner_id = $1::uuid and is_active = true
       ) as exists`,
      [partnerId]
    )
    return Boolean(row?.exists)
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return false
    console.warn('[hasAnyPartnerCategoriesFromPg]', e)
    return false
  }
}

export async function fetchPartnerCategoryByIdFromPg(
  partnerId: string,
  categoryId: string
): Promise<PartnerCategoryRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<CategoryDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_categories
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, categoryId]
    )
    return row ? mapCategoryRow(row) : null
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return null
    console.warn('[fetchPartnerCategoryByIdFromPg]', e)
    return null
  }
}

/** Resolve theo full path ("ao/ao-thun-nam") — dùng cho route công khai `/site/{slug}/c/{...path}` (W4.7). */
export async function fetchPartnerCategoryByPathFromPg(
  partnerId: string,
  path: string,
  opts: { activeOnly?: boolean } = {}
): Promise<PartnerCategoryRow | null> {
  if (!isPgConfigured()) return null
  const activeOnly = opts.activeOnly !== false
  const cleanPath = path.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  if (!cleanPath) return null
  try {
    const row = await pgQueryOne<CategoryDbRow>(
      `select ${SELECT_COLS}
       from public.messaging_partner_categories
       where partner_id = $1::uuid and path = $2
         ${activeOnly ? 'and is_active = true' : ''}`,
      [partnerId, cleanPath]
    )
    return row ? mapCategoryRow(row) : null
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return null
    console.warn('[fetchPartnerCategoryByPathFromPg]', e)
    return null
  }
}

export type CreatePartnerCategoryResult =
  | { ok: true; row: PartnerCategoryRow }
  | { ok: false; error: 'duplicate_slug' | 'duplicate_path' | 'parent_not_found' | 'max_depth' | 'invalid_slug' | 'db_error' }

/**
 * Tạo 1 danh mục. Tự tính `path`/`depth` từ cha (nếu có). Không tự tạo trọn nhánh như 188 —
 * CRUD từng node độc lập (xem docs/188_BEHAVIOR_SPEC.md mục A.8, điểm #6 "không nên copy").
 */
export async function insertPartnerCategoryFromPg(
  input: PartnerCategoryCreateInput
): Promise<CreatePartnerCategoryResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }

  const name = input.name.trim().slice(0, 200)
  if (!name) return { ok: false, error: 'db_error' }

  let slug = (input.slug ?? '').trim().toLowerCase()
  if (!slug) slug = slugifyPartnerCategoryName(name)
  if (!isValidPartnerCategorySlug(slug)) return { ok: false, error: 'invalid_slug' }

  let parentPath: string | null = null
  let depth = 1
  if (input.parentId) {
    const parent = await fetchPartnerCategoryByIdFromPg(input.partnerId, input.parentId)
    if (!parent) return { ok: false, error: 'parent_not_found' }
    parentPath = parent.path
    depth = parent.depth + 1
    if (depth > PARTNER_CATEGORY_MAX_DEPTH) return { ok: false, error: 'max_depth' }
  }
  const path = buildPartnerCategoryPath(parentPath, slug)

  try {
    const row = await pgQueryOne<CategoryDbRow>(
      `insert into public.messaging_partner_categories (
        partner_id, parent_id, name, name_i18n, slug, path, depth, sort_order, is_active,
        image_url, description, description_i18n, seo_title, seo_description, seo_index, ai_generated,
        ai_generated_at
      ) values (
        $1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16,
        case when $16 then now() else null end
      )
      returning ${SELECT_COLS}`,
      [
        input.partnerId,
        input.parentId ?? null,
        name,
        JSON.stringify(normalizePartnerCategoryI18nMap(input.nameI18n)),
        slug,
        path,
        depth,
        input.sortOrder ?? 0,
        input.isActive !== false,
        (input.imageUrl ?? '').trim().slice(0, 2000),
        (input.description ?? '').trim().slice(0, 5000),
        JSON.stringify(normalizePartnerCategoryI18nMap(input.descriptionI18n)),
        (input.seoTitle ?? '').trim().slice(0, 200),
        (input.seoDescription ?? '').trim().slice(0, 500),
        input.seoIndex !== false,
        input.aiGenerated === true,
      ]
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapCategoryRow(row) }
  } catch (e) {
    const uniq = isUniqueViolation(e)
    if (uniq) {
      if (uniq.constraint.includes('path')) return { ok: false, error: 'duplicate_path' }
      return { ok: false, error: 'duplicate_slug' }
    }
    console.warn('[insertPartnerCategoryFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

/** Gán 1 sản phẩm vào 1 danh mục. `isPrimary=true` sẽ tự bỏ primary cũ (constraint chỉ cho 1 primary/sản phẩm). */
export async function assignInventoryToCategoryFromPg(
  partnerId: string,
  inventoryId: string,
  categoryId: string,
  isPrimary: boolean
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    if (isPrimary) {
      await pgQuery(
        `update public.messaging_partner_inventory_categories
         set is_primary = false
         where inventory_id = $1::uuid and is_primary = true`,
        [inventoryId]
      )
    }
    await pgQuery(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
       values ($1::uuid, $2::uuid, $3)
       on conflict (inventory_id, category_id) do update set is_primary = excluded.is_primary`,
      [inventoryId, categoryId, isPrimary]
    )
    return true
  } catch (e) {
    console.warn('[assignInventoryToCategoryFromPg]', e, { partnerId })
    return false
  }
}

export async function unassignInventoryFromCategoryFromPg(
  inventoryId: string,
  categoryId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `delete from public.messaging_partner_inventory_categories
       where inventory_id = $1::uuid and category_id = $2::uuid`,
      [inventoryId, categoryId]
    )
    return true
  } catch (e) {
    console.warn('[unassignInventoryFromCategoryFromPg]', e)
    return false
  }
}

/** Danh mục gắn với 1 sản phẩm (kèm cờ danh mục chính). */
/** W1.5 — resolve size guide image from primary category (fallback: any linked category with image). */
export async function fetchSizeGuideImageUrlForInventoryFromPg(
  partnerId: string,
  inventoryId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ size_guide_image_url: string }>(
      `select coalesce(c.size_guide_image_url, '') as size_guide_image_url
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_categories c on c.id = pic.category_id
       where pic.inventory_id = $1::uuid
         and c.partner_id = $2::uuid
         and coalesce(c.size_guide_image_url, '') <> ''
       order by pic.is_primary desc, c.depth desc
       limit 1`,
      [inventoryId, partnerId]
    )
    const url = String(row?.size_guide_image_url ?? '').trim()
    return url || null
  } catch (e) {
    console.warn('[fetchSizeGuideImageUrlForInventoryFromPg]', e)
    return null
  }
}

export async function fetchCategoryIdsForInventoryFromPg(
  inventoryId: string
): Promise<Array<{ categoryId: string; isPrimary: boolean }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ category_id: string; is_primary: boolean }>(
      `select category_id::text, is_primary
       from public.messaging_partner_inventory_categories
       where inventory_id = $1::uuid`,
      [inventoryId]
    )
    return rows.map((r) => ({ categoryId: r.category_id, isPrimary: Boolean(r.is_primary) }))
  } catch (e) {
    console.warn('[fetchCategoryIdsForInventoryFromPg]', e)
    return null
  }
}

/**
 * Breadcrumb danh mục chính của từng SP (`Túi > Túi đeo chéo`) — dùng feed catalog ads.
 */
export async function fetchInventoryProductTypeBreadcrumbsFromPg(
  partnerId: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!isPgConfigured()) return out
  try {
    const cats = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
    if (!cats || cats.length === 0) return out
    const byId = new Map(cats.map((c) => [c.id, c]))
    const links = await pgQuery<{ inventory_id: string; category_id: string; is_primary: boolean }>(
      `select pic.inventory_id::text, pic.category_id::text, pic.is_primary
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_categories c on c.id = pic.category_id
       where c.partner_id = $1::uuid`,
      [partnerId]
    )
    const best = new Map<string, { categoryId: string; isPrimary: boolean; depth: number }>()
    for (const link of links) {
      const cat = byId.get(link.category_id)
      if (!cat) continue
      const prev = best.get(link.inventory_id)
      const isPrimary = Boolean(link.is_primary)
      if (
        !prev ||
        (isPrimary && !prev.isPrimary) ||
        (isPrimary === prev.isPrimary && cat.depth > prev.depth)
      ) {
        best.set(link.inventory_id, { categoryId: cat.id, isPrimary, depth: cat.depth })
      }
    }
    for (const [inventoryId, pick] of best) {
      const names: string[] = []
      let cur = byId.get(pick.categoryId)
      const guard = new Set<string>()
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id)
        const label = (cur.name ?? '').trim()
        if (label) names.unshift(label)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      if (names.length) out.set(inventoryId, names.join(' > '))
    }
    return out
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return out
    console.warn('[fetchInventoryProductTypeBreadcrumbsFromPg]', e)
    return out
  }
}

/**
 * ID sản phẩm gán trực tiếp vào 1 danh mục (không gộp con — caller tự UNION nếu cần cả nhánh).
 */
export async function fetchInventoryIdsForCategoryFromPg(
  categoryId: string
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ inventory_id: string }>(
      `select inventory_id::text
       from public.messaging_partner_inventory_categories
       where category_id = $1::uuid`,
      [categoryId]
    )
    return rows.map((r) => r.inventory_id)
  } catch (e) {
    console.warn('[fetchInventoryIdsForCategoryFromPg]', e)
    return null
  }
}

/** Đếm sản phẩm active gán trực tiếp theo từng category_id của 1 shop — dùng cho tile/nav badge. */
export async function fetchDirectProductCountsByCategoryFromPg(
  partnerId: string
): Promise<Map<string, number> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ category_id: string; c: number }>(
      `select pic.category_id::text, count(*)::int as c
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_inventory inv on inv.id = pic.inventory_id
       join public.messaging_partner_categories cat on cat.id = pic.category_id
       where cat.partner_id = $1::uuid
         and coalesce(inv.is_active, true) = true
       group by pic.category_id`,
      [partnerId]
    )
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.category_id, r.c)
    return m
  } catch (e) {
    if (isMissingCategoriesTableError(e)) return new Map()
    console.warn('[fetchDirectProductCountsByCategoryFromPg]', e)
    return null
  }
}

/** Cây đầy đủ cho admin (gồm cả inactive) + đếm sản phẩm trực tiếp mỗi node — dùng cho panel quản trị (W4.4). */
export async function fetchPartnerCategoryTreeForAdminFromPg(
  partnerId: string
): Promise<PartnerCategoryTreeNode[] | null> {
  const [rows, counts] = await Promise.all([
    fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false }),
    fetchDirectProductCountsByCategoryFromPg(partnerId),
  ])
  if (rows === null) return null
  const tree = buildPartnerCategoryTree(rows)
  if (counts) {
    const applyCounts = (nodes: PartnerCategoryTreeNode[]) => {
      for (const n of nodes) {
        n.productCount = counts.get(n.id) ?? 0
        if (n.children.length) applyCounts(n.children)
      }
    }
    applyCounts(tree)
  }
  return tree
}

export type UpdatePartnerCategoryFieldsInput = {
  name?: string
  nameI18n?: PartnerCategoryNameI18n
  imageUrl?: string
  description?: string
  descriptionI18n?: PartnerCategoryNameI18n
  seoTitle?: string
  seoDescription?: string
  seoIndex?: boolean
  seoBody?: string
  sizeGuideImageUrl?: string
  isActive?: boolean
}

/** Cập nhật các field không đụng parent/slug/path (đổi parent/slug dùng `movePartnerCategoryFromPg`). */
export async function updatePartnerCategoryFieldsFromPg(
  partnerId: string,
  categoryId: string,
  patch: UpdatePartnerCategoryFieldsInput
): Promise<PartnerCategoryRow | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = []
  const params: unknown[] = [partnerId, categoryId]
  let p = 3

  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 200)
    if (!name) return null
    // PS.8 — merchant sửa tên = coi như đã xem lại node do AI tạo, xoá cờ "cần xem lại".
    sets.push(`name = $${p++}`, 'ai_generated = false', 'ai_generated_at = null')
    params.push(name)
  }
  if (patch.nameI18n !== undefined) {
    sets.push(`name_i18n = $${p++}::jsonb`)
    params.push(JSON.stringify(normalizePartnerCategoryI18nMap(patch.nameI18n)))
  }
  if (patch.imageUrl !== undefined) {
    sets.push(`image_url = $${p++}`)
    params.push(patch.imageUrl.trim().slice(0, 2000))
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${p++}`)
    params.push(patch.description.trim().slice(0, 5000))
  }
  if (patch.descriptionI18n !== undefined) {
    sets.push(`description_i18n = $${p++}::jsonb`)
    params.push(JSON.stringify(normalizePartnerCategoryI18nMap(patch.descriptionI18n)))
  }
  if (patch.seoTitle !== undefined) {
    sets.push(`seo_title = $${p++}`)
    params.push(patch.seoTitle.trim().slice(0, 200))
  }
  if (patch.seoDescription !== undefined) {
    sets.push(`seo_description = $${p++}`)
    params.push(patch.seoDescription.trim().slice(0, 500))
  }
  if (patch.seoIndex !== undefined) {
    sets.push(`seo_index = $${p++}`)
    params.push(patch.seoIndex)
  }
  if (patch.seoBody !== undefined) {
    // Sửa tay -> coi như "không còn do AI sinh nữa" (xoá mốc generated_at/locale) để admin
    // biết seo_body hiện tại là bản họ tự viết, không phải bản AI gần nhất.
    sets.push(`seo_body = $${p++}`, 'seo_body_generated_at = null', 'seo_body_generated_locale = null')
    params.push(patch.seoBody.trim().slice(0, 3000))
  }
  if (patch.sizeGuideImageUrl !== undefined) {
    sets.push(`size_guide_image_url = $${p++}`)
    params.push(patch.sizeGuideImageUrl.trim().slice(0, 2000))
  }
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${p++}`)
    params.push(patch.isActive)
  }

  if (!sets.length) return fetchPartnerCategoryByIdFromPg(partnerId, categoryId)

  try {
    const row = await pgQueryOne<CategoryDbRow>(
      `update public.messaging_partner_categories
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      params
    )
    return row ? mapCategoryRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerCategoryFieldsFromPg]', e)
    return null
  }
}

export type MovePartnerCategoryResult =
  | { ok: true; row: PartnerCategoryRow }
  | {
      ok: false
      error:
        | 'not_found'
        | 'parent_not_found'
        | 'cycle'
        | 'max_depth'
        | 'duplicate_slug'
        | 'duplicate_path'
        | 'invalid_slug'
        | 'db_error'
    }

/**
 * Đổi cha (`newParentId`) và/hoặc slug — tự rebuild `path`/`depth` cho node + toàn bộ hậu duệ
 * trong 1 transaction. Chặn di chuyển vào chính nhánh con của nó (cycle).
 */
export async function movePartnerCategoryFromPg(
  partnerId: string,
  categoryId: string,
  input: { newParentId?: string | null; newSlug?: string }
): Promise<MovePartnerCategoryResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }

  const current = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
  if (!current) return { ok: false, error: 'not_found' }

  const newParentId = input.newParentId === undefined ? current.parentId : input.newParentId
  let newSlug = current.slug
  if (input.newSlug !== undefined) {
    newSlug = input.newSlug.trim().toLowerCase()
    if (!isValidPartnerCategorySlug(newSlug)) return { ok: false, error: 'invalid_slug' }
  }

  if (newParentId === categoryId) return { ok: false, error: 'cycle' }

  let newParent: PartnerCategoryRow | null = null
  if (newParentId) {
    newParent = await fetchPartnerCategoryByIdFromPg(partnerId, newParentId)
    if (!newParent) return { ok: false, error: 'parent_not_found' }
    if (newParent.path === current.path || newParent.path.startsWith(`${current.path}/`)) {
      return { ok: false, error: 'cycle' }
    }
  }

  const newParentPath = newParent?.path ?? null
  const newDepth = newParent ? newParent.depth + 1 : 1
  const newPath = buildPartnerCategoryPath(newParentPath, newSlug)
  const depthDelta = newDepth - current.depth

  if (newPath === current.path) {
    // Không đổi gì thực sự (cùng cha, cùng slug).
    return { ok: true, row: current }
  }

  try {
    const maxDescendantDepthRow = await pgQueryOne<{ max_depth: number | null }>(
      `select max(depth)::int as max_depth
       from public.messaging_partner_categories
       where partner_id = $1::uuid and (path = $2 or path like $2 || '/%')`,
      [partnerId, current.path]
    )
    const maxDescendantDepth = maxDescendantDepthRow?.max_depth ?? current.depth
    if (maxDescendantDepth + depthDelta > PARTNER_CATEGORY_MAX_DEPTH) {
      return { ok: false, error: 'max_depth' }
    }
  } catch (e) {
    console.warn('[movePartnerCategoryFromPg] depth check failed', e)
    return { ok: false, error: 'db_error' }
  }

  const client = await getPgPool().connect()
  try {
    await client.query('begin')

    // Hậu duệ trước (path vẫn còn bắt đầu bằng path cũ tại thời điểm này).
    await client.query(
      `update public.messaging_partner_categories
       set path = $1 || substring(path from ${current.path.length + 1}),
           depth = depth + $2,
           updated_at = now()
       where partner_id = $3::uuid and path like $4 || '/%'`,
      [newPath, depthDelta, partnerId, current.path]
    )

    const res = await client.query(
      `update public.messaging_partner_categories
       set parent_id = $1::uuid, slug = $2, path = $3, depth = $4, updated_at = now()
       where partner_id = $5::uuid and id = $6::uuid
       returning ${SELECT_COLS}`,
      [newParentId, newSlug, newPath, newDepth, partnerId, categoryId]
    )

    await client.query('commit')
    const row = res.rows[0] as CategoryDbRow | undefined
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapCategoryRow(row) }
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    const uniq = isUniqueViolation(e)
    if (uniq) {
      if (uniq.constraint.includes('path')) return { ok: false, error: 'duplicate_path' }
      return { ok: false, error: 'duplicate_slug' }
    }
    console.warn('[movePartnerCategoryFromPg]', e)
    return { ok: false, error: 'db_error' }
  } finally {
    client.release()
  }
}

/**
 * Sắp xếp thật trong dashboard (nút lên/xuống) — chuẩn hoá lại `sort_order` 0..n-1 cho toàn bộ
 * anh em cùng cha để tránh lệch do dữ liệu cũ trùng/lỗ hổng sort_order.
 * Xem docs/188_BEHAVIOR_SPEC.md mục A.8 điểm #6 — 188 chỉ có sort_order nhập tay qua Excel.
 */
export async function reorderPartnerCategorySiblingFromPg(
  partnerId: string,
  categoryId: string,
  direction: 'up' | 'down'
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const current = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
  if (!current) return false

  try {
    const siblings = await pgQuery<{ id: string }>(
      `select id::text
       from public.messaging_partner_categories
       where partner_id = $1::uuid
         and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       order by sort_order asc, name asc, id asc`,
      [partnerId, current.parentId]
    )
    const ids = siblings.map((s) => s.id)
    const idx = ids.indexOf(categoryId)
    if (idx === -1) return false
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= ids.length) return true // đã ở đầu/cuối — không phải lỗi

    ;[ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]]

    const client = await getPgPool().connect()
    try {
      await client.query('begin')
      for (let i = 0; i < ids.length; i += 1) {
        await client.query(
          `update public.messaging_partner_categories
           set sort_order = $1, updated_at = now()
           where id = $2::uuid and partner_id = $3::uuid`,
          [i, ids[i], partnerId]
        )
      }
      await client.query('commit')
      return true
    } catch (e) {
      await client.query('rollback').catch(() => undefined)
      console.warn('[reorderPartnerCategorySiblingFromPg]', e)
      return false
    } finally {
      client.release()
    }
  } catch (e) {
    console.warn('[reorderPartnerCategorySiblingFromPg] fetch siblings failed', e)
    return false
  }
}

export async function fetchPartnerCategoryChildCountFromPg(
  partnerId: string,
  categoryId: string
): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.messaging_partner_categories
       where partner_id = $1::uuid and parent_id = $2::uuid`,
      [partnerId, categoryId]
    )
    return row?.c ?? 0
  } catch (e) {
    console.warn('[fetchPartnerCategoryChildCountFromPg]', e)
    return 0
  }
}

/** Xoá 1 danh mục. FK `on delete cascade` tự xoá hậu duệ + gỡ liên kết sản phẩm liên quan. */
export async function deletePartnerCategoryFromPg(
  partnerId: string,
  categoryId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_categories
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, categoryId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerCategoryFromPg]', e)
    return false
  }
}

/** Tên tối đa `limit` sản phẩm active gán trực tiếp vào danh mục — dùng làm ngữ cảnh cho prompt AI sinh SEO. */
export async function fetchPartnerCategoryProductSampleNamesFromPg(
  categoryId: string,
  limit = 6
): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ name: string }>(
      `select inv.name
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_inventory inv on inv.id = pic.inventory_id
       where pic.category_id = $1::uuid and coalesce(inv.is_active, true) = true
       order by inv.updated_at desc
       limit $2`,
      [categoryId, limit]
    )
    return rows.map((r) => (r.name ?? '').trim()).filter(Boolean)
  } catch (e) {
    console.warn('[fetchPartnerCategoryProductSampleNamesFromPg]', e)
    return []
  }
}

/** Ghi kết quả AI sinh SEO cho 1 danh mục — luôn set `seo_body_generated_at`/`locale` để phân biệt bản AI vs bản merchant tự viết. */
export async function setPartnerCategoryGeneratedSeoFromPg(
  partnerId: string,
  categoryId: string,
  input: { seoDescription?: string; seoBody?: string; locale: string }
): Promise<PartnerCategoryRow | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = ['seo_body_generated_at = now()', 'seo_body_generated_locale = $3']
  const params: unknown[] = [partnerId, categoryId, input.locale]
  let p = 4
  if (input.seoDescription !== undefined) {
    sets.push(`seo_description = $${p++}`)
    params.push(input.seoDescription.trim().slice(0, 500))
  }
  if (input.seoBody !== undefined) {
    sets.push(`seo_body = $${p++}`)
    params.push(input.seoBody.trim().slice(0, 3000))
  }
  try {
    const row = await pgQueryOne<CategoryDbRow>(
      `update public.messaging_partner_categories
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      params
    )
    return row ? mapCategoryRow(row) : null
  } catch (e) {
    console.warn('[setPartnerCategoryGeneratedSeoFromPg]', e)
    return null
  }
}

/**
 * Gán hàng loạt (W4.5) — thay toàn bộ danh sách sản phẩm của 1 danh mục bằng `inventoryIds`.
 * Sản phẩm mới được set `is_primary=true` chỉ khi nó CHƯA thuộc danh mục nào khác (heuristic
 * để breadcrumb/canonical luôn có danh mục chính mặc định).
 */
export async function setCategoryProductsFromPg(
  partnerId: string,
  categoryId: string,
  inventoryIds: string[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const category = await fetchPartnerCategoryByIdFromPg(partnerId, categoryId)
  if (!category) return false
  const ids = Array.from(new Set(inventoryIds.map((x) => x.trim()).filter(Boolean)))

  const client = await getPgPool().connect()
  try {
    await client.query('begin')

    await client.query(
      `delete from public.messaging_partner_inventory_categories
       where category_id = $1::uuid
         and not (inventory_id = any($2::uuid[]))`,
      [categoryId, ids]
    )

    for (const invId of ids) {
      const existingCount = await client.query<{ c: number }>(
        `select count(*)::int as c from public.messaging_partner_inventory_categories
         where inventory_id = $1::uuid`,
        [invId]
      )
      const alreadyHasAny = (existingCount.rows[0]?.c ?? 0) > 0
      await client.query(
        `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
         values ($1::uuid, $2::uuid, $3)
         on conflict (inventory_id, category_id) do nothing`,
        [invId, categoryId, !alreadyHasAny]
      )
    }

    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[setCategoryProductsFromPg]', e)
    return false
  } finally {
    client.release()
  }
}
