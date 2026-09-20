import type { PoolClient } from 'pg'
import { bumpInventoryCacheLater } from '@/lib/cache/partner-shop-cache'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import {
  draftsFromTaxonomySheets,
  emptyTaxonomyImportSummary,
  type TaxonomyCategoryDraft,
  type TaxonomyClusterDraft,
  type TaxonomyImportSummary,
  type TaxonomyParsedSheets,
} from '@/lib/partner-website/category/partner-category-taxonomy-import'
import { storedSeoIndexForTaxonomyCategory } from '@/lib/partner-website/category/partner-category-public-index'

type ClusterDbRow = {
  id: string
  external_id: string
  slug: string
  name: string
  index_policy: string
}

type CatLookup = {
  id: string
  external_id: string | null
  parent_id: string | null
  parent_external_id: string | null
  name: string
  slug: string
  path: string
  depth: number
}

function isUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && (e as { code?: string }).code === '23505')
}

function isMissingTaxonomyTableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  if (code !== '42P01' && code !== '42703') return false
  const msg = String((e as { message?: unknown }).message ?? '')
  return /messaging_partner_seo_clusters|external_id|seo_cluster_id/i.test(msg)
}

export type TaxonomyFormTreeNode = {
  db_id: string
  external_id: string | null
  parent_id: string | null
  level: number
  name: string
  slug: string
  full_slug: string
  sort_order: number
  seo_index: boolean
  children: TaxonomyFormTreeNode[]
}

export type TaxonomyClusterOption = {
  external_id: string
  slug: string
  name: string
  index_policy: string
}

export type TaxonomyInfo = {
  categories: { cat1: number; cat2: number; cat3: number }
  clusters: number
  products: { total: number; linked_to_cat3: number }
}

export async function fetchPartnerTaxonomyInfoFromPg(partnerId: string): Promise<TaxonomyInfo | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  try {
    const cats = await pool.query<{ depth: number; c: number }>(
      `select depth, count(*)::int as c
       from public.messaging_partner_categories
       where partner_id = $1::uuid
       group by depth`,
      [partnerId]
    )
    const byDepth = new Map(cats.rows.map((r) => [r.depth, r.c]))
    let clusters = 0
    try {
      const cl = await pool.query<{ c: number }>(
        `select count(*)::int as c from public.messaging_partner_seo_clusters where partner_id = $1::uuid`,
        [partnerId]
      )
      clusters = cl.rows[0]?.c ?? 0
    } catch (e) {
      if (!isMissingTaxonomyTableError(e)) throw e
    }
    const products = await pool.query<{ total: number; linked: number }>(
      `select
         (select count(*)::int from public.messaging_partner_inventory where partner_id = $1::uuid) as total,
         (select count(distinct pic.inventory_id)::int
          from public.messaging_partner_inventory_categories pic
          join public.messaging_partner_categories c on c.id = pic.category_id
          where c.partner_id = $1::uuid) as linked`,
      [partnerId]
    )
    return {
      categories: {
        cat1: byDepth.get(1) ?? 0,
        cat2: byDepth.get(2) ?? 0,
        cat3: byDepth.get(3) ?? 0,
      },
      clusters,
      products: {
        total: products.rows[0]?.total ?? 0,
        linked_to_cat3: products.rows[0]?.linked ?? 0,
      },
    }
  } catch (e) {
    console.warn('[fetchPartnerTaxonomyInfoFromPg]', e)
    return null
  }
}

export async function fetchPartnerTaxonomyFormTreeFromPg(partnerId: string): Promise<TaxonomyFormTreeNode[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await getPgPool().query<{
      id: string
      parent_id: string | null
      name: string
      slug: string
      path: string
      depth: number
      sort_order: number
      seo_index: boolean
      external_id: string | null
    }>(
      `select id::text, parent_id::text, name, slug, path, depth, sort_order, seo_index,
              nullif(btrim(coalesce(external_id, '')), '') as external_id
       from public.messaging_partner_categories
       where partner_id = $1::uuid
       order by depth asc, sort_order asc, name asc`,
      [partnerId]
    )
    const byId = new Map<string, TaxonomyFormTreeNode>()
    for (const r of rows.rows) {
      byId.set(r.id, {
        db_id: r.id,
        external_id: r.external_id,
        parent_id: r.parent_id,
        level: r.depth,
        name: r.name,
        slug: r.slug,
        full_slug: r.path,
        sort_order: r.sort_order,
        seo_index: r.seo_index !== false,
        children: [],
      })
    }
    const roots: TaxonomyFormTreeNode[] = []
    const sortChildren = (nodes: TaxonomyFormTreeNode[]) => {
      nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name) || a.db_id.localeCompare(b.db_id))
      for (const n of nodes) sortChildren(n.children)
    }
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id)!.children.push(node)
      else if (node.level === 1) roots.push(node)
    }
    sortChildren(roots)
    return roots
  } catch (e) {
    if (isMissingTaxonomyTableError(e)) return []
    console.warn('[fetchPartnerTaxonomyFormTreeFromPg]', e)
    return []
  }
}

export async function fetchPartnerTaxonomyClustersFromPg(partnerId: string): Promise<TaxonomyClusterOption[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await getPgPool().query<TaxonomyClusterOption>(
      `select external_id, slug, name, index_policy
       from public.messaging_partner_seo_clusters
       where partner_id = $1::uuid
       order by slug asc`,
      [partnerId]
    )
    return rows.rows
  } catch (e) {
    if (isMissingTaxonomyTableError(e)) return []
    console.warn('[fetchPartnerTaxonomyClustersFromPg]', e)
    return []
  }
}

export async function fetchPartnerCategoryByExternalIdFromPg(
  partnerId: string,
  externalId: string
): Promise<CatLookup | null> {
  if (!isPgConfigured()) return null
  const id = externalId.trim()
  if (!id) return null
  try {
    const row = await getPgPool().query<CatLookup>(
      `select c.id::text, c.external_id, c.parent_id::text, p.external_id as parent_external_id,
              c.name, c.slug, c.path, c.depth
       from public.messaging_partner_categories c
       left join public.messaging_partner_categories p on p.id = c.parent_id
       where c.partner_id = $1::uuid and c.external_id = $2
       limit 1`,
      [partnerId, id]
    )
    return row.rows[0] ?? null
  } catch (e) {
    if (isMissingTaxonomyTableError(e)) return null
    console.warn('[fetchPartnerCategoryByExternalIdFromPg]', e)
    return null
  }
}

export async function fetchPartnerSeoClusterByExternalIdFromPg(
  partnerId: string,
  externalId: string
): Promise<TaxonomyClusterOption | null> {
  const id = externalId.trim()
  if (!id) return null
  const all = await fetchPartnerTaxonomyClustersFromPg(partnerId)
  return all.find((c) => c.external_id === id) ?? null
}

async function upsertClustersMap(
  client: PoolClient,
  partnerId: string,
  drafts: TaxonomyClusterDraft[],
  errors: string[]
): Promise<{ map: Map<string, string>; inserted: number; updated: number }> {
  const existing = await client.query<ClusterDbRow>(
    `select id::text, external_id, slug, name, index_policy
     from public.messaging_partner_seo_clusters
     where partner_id = $1::uuid`,
    [partnerId]
  )
  const map = new Map<string, string>()
  for (const r of existing.rows) map.set(r.external_id, r.id)
  let inserted = 0
  let updated = 0

  for (const draft of drafts) {
    const foundId = map.get(draft.externalId)
    try {
      if (!foundId) {
        const row = await client.query<{ id: string }>(
          `insert into public.messaging_partner_seo_clusters (
             partner_id, external_id, slug, name, canonical_path, index_policy, source, notes
           ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
           returning id::text`,
          [
            partnerId,
            draft.externalId,
            draft.slug,
            draft.name,
            draft.canonicalPath,
            draft.indexPolicy,
            draft.source,
            draft.notes,
          ]
        )
        const id = row.rows[0]?.id
        if (id) map.set(draft.externalId, id)
        inserted += 1
      } else {
        await client.query(
          `update public.messaging_partner_seo_clusters
           set slug = $3, name = $4, canonical_path = $5, index_policy = $6, source = $7, notes = $8, updated_at = now()
           where partner_id = $1::uuid and id = $2::uuid`,
          [
            partnerId,
            foundId,
            draft.slug,
            draft.name,
            draft.canonicalPath,
            draft.indexPolicy,
            draft.source,
            draft.notes,
          ]
        )
        updated += 1
      }
    } catch (e) {
      if (isUniqueViolation(e)) {
        errors.push(`seo_clusters ${draft.externalId}: slug/id đã tồn tại`)
        continue
      }
      throw e
    }
  }
  return { map, inserted, updated }
}

async function upsertCategories(
  client: PoolClient,
  partnerId: string,
  drafts: TaxonomyCategoryDraft[],
  clusterMap: Map<string, string>,
  errors: string[]
): Promise<{ map: Map<string, string>; inserted: Record<1 | 2 | 3, number>; updated: Record<1 | 2 | 3, number> }> {
  const existing = await client.query<{
    id: string
    external_id: string | null
    path: string
  }>(
    `select id::text, nullif(btrim(coalesce(external_id, '')), '') as external_id, path
     from public.messaging_partner_categories
     where partner_id = $1::uuid`,
    [partnerId]
  )
  const byExt = new Map<string, string>()
  const byPath = new Map<string, { id: string; external_id: string | null }>()
  for (const r of existing.rows) {
    if (r.external_id) byExt.set(r.external_id, r.id)
    byPath.set(r.path, { id: r.id, external_id: r.external_id })
  }

  const inserted: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }
  const updated: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 }

  for (const draft of drafts) {
    let parentId: string | null = null
    if (draft.parentExternalId) {
      parentId = byExt.get(draft.parentExternalId) ?? null
      if (!parentId) {
        errors.push(
          `categories row ${draft.excelRow} (${draft.externalId}): parent_id=${draft.parentExternalId} không tồn tại (level đang xử lý ${draft.level})`
        )
        continue
      }
    } else if (draft.level !== 1) {
      errors.push(`categories row ${draft.excelRow} (${draft.externalId}): cấp ${draft.level} thiếu parent_id`)
      continue
    }

    let clusterId: string | null = null
    if (draft.clusterExternalId) {
      clusterId = clusterMap.get(draft.clusterExternalId) ?? null
      if (!clusterId) {
        errors.push(
          `categories row ${draft.excelRow} (${draft.externalId}): seo_cluster_id=${draft.clusterExternalId} không có trong sheet seo_clusters`
        )
      }
    }

    let existingId = byExt.get(draft.externalId) ?? null
    if (!existingId) {
      const pathHit = byPath.get(draft.fullSlug)
      if (pathHit && !pathHit.external_id) existingId = pathHit.id
      else if (pathHit && pathHit.external_id && pathHit.external_id !== draft.externalId) {
        errors.push(
          `categories row ${draft.excelRow} (${draft.externalId}): full_slug=${draft.fullSlug} đã thuộc ${pathHit.external_id}`
        )
        continue
      }
    }

    try {
      if (!existingId) {
        const row = await client.query<{ id: string }>(
          `insert into public.messaging_partner_categories (
             partner_id, parent_id, name, slug, path, depth, sort_order, is_active,
             seo_index, external_id, seo_cluster_id, ai_generated
           ) values (
             $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, false
           )
           returning id::text`,
          [
            partnerId,
            parentId,
            draft.name,
            draft.slug,
            draft.fullSlug,
            draft.level,
            draft.sortOrder,
            draft.isActive,
            storedSeoIndexForTaxonomyCategory(draft.level, draft.seoIndex),
            draft.externalId,
            clusterId,
          ]
        )
        const id = row.rows[0]?.id
        if (!id) {
          errors.push(`categories row ${draft.excelRow} (${draft.externalId}): không ghi được`)
          continue
        }
        existingId = id
        inserted[draft.level] += 1
      } else {
        await client.query(
          `update public.messaging_partner_categories
           set parent_id = $3::uuid,
               name = $4,
               slug = $5,
               path = $6,
               depth = $7,
               sort_order = $8,
               is_active = $9,
               seo_index = $10,
               external_id = $11,
               seo_cluster_id = $12::uuid,
               updated_at = now()
           where partner_id = $1::uuid and id = $2::uuid`,
          [
            partnerId,
            existingId,
            parentId,
            draft.name,
            draft.slug,
            draft.fullSlug,
            draft.level,
            draft.sortOrder,
            draft.isActive,
            storedSeoIndexForTaxonomyCategory(draft.level, draft.seoIndex),
            draft.externalId,
            clusterId,
          ]
        )
        updated[draft.level] += 1
      }
      byExt.set(draft.externalId, existingId)
      byPath.set(draft.fullSlug, { id: existingId, external_id: draft.externalId })
    } catch (e) {
      if (isUniqueViolation(e)) {
        errors.push(`categories row ${draft.excelRow} (${draft.externalId}): slug/path đã tồn tại`)
        continue
      }
      throw e
    }
  }

  return { map: byExt, inserted, updated }
}

function validatePaths(
  sheets: TaxonomyParsedSheets,
  catMap: Map<string, string>,
  clusterMap: Map<string, string>
): string[] {
  const errs: string[] = []
  sheets.category_paths.forEach((row, i) => {
    const excelRow = i + 2
    const cat3 = String(row.cat3_id || '').trim()
    if (cat3 && !catMap.has(cat3)) {
      errs.push(`category_paths row ${excelRow}: cat3_id=${cat3} không có trong sheet categories`)
    }
    const cluster = String(row.seo_cluster_id || '').trim()
    if (cluster && !clusterMap.has(cluster)) {
      errs.push(`category_paths row ${excelRow}: seo_cluster_id=${cluster} không có trong sheet seo_clusters`)
    }
  })
  return errs
}

export async function executePartnerTaxonomySheetsFromPg(
  partnerId: string,
  sheets: TaxonomyParsedSheets
): Promise<TaxonomyImportSummary | { ok: false; error: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'Database not configured' }
  const started = Date.now()
  const parsed = draftsFromTaxonomySheets(sheets)
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    const clusterErrors = [...parsed.clusterErrors]
    const categoryErrors = [...parsed.categoryErrors]
    const clusters = await upsertClustersMap(client, partnerId, parsed.clusters, clusterErrors)
    const cats = await upsertCategories(client, partnerId, parsed.categories, clusters.map, categoryErrors)
    const pathErrors = validatePaths(sheets, cats.map, clusters.map)
    await client.query('commit')
    bumpInventoryCacheLater(partnerId)
    const summary = emptyTaxonomyImportSummary(Date.now() - started)
    summary.summary.categories['1'] = { inserted: cats.inserted[1], updated: cats.updated[1] }
    summary.summary.categories['2'] = { inserted: cats.inserted[2], updated: cats.updated[2] }
    summary.summary.categories['3'] = { inserted: cats.inserted[3], updated: cats.updated[3] }
    summary.summary.clusters = {
      inserted: clusters.inserted,
      updated: clusters.updated,
      in_database_after: clusters.map.size,
    }
    summary.errors = {
      seo_clusters: clusterErrors,
      categories: categoryErrors,
      category_paths: pathErrors,
    }
    summary.meta = parsed.meta
    return summary
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    if (isMissingTaxonomyTableError(e)) {
      return { ok: false, error: 'Chưa chạy migration taxonomy import (external_id / seo_clusters).' }
    }
    console.warn('[executePartnerTaxonomySheetsFromPg]', e)
    return { ok: false, error: e instanceof Error ? e.message : 'db_error' }
  } finally {
    client.release()
  }
}
