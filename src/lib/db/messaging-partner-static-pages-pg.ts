import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isValidCustomPageSlug, type PartnerStaticPageRow } from '@/lib/partner-website/pages/partner-static-page-types'

/**
 * W3.3 + W3.4 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CMS trang tĩnh + SEO theo shop.
 */

type StaticPageDbRow = {
  id: string
  partner_id: string
  slug: string
  title: string
  content: string
  seo_title: string
  seo_description: string
  seo_index: boolean
  is_published: boolean
  created_at: unknown
  updated_at: unknown
}

const SELECT_COLS = `id::text, partner_id::text, slug, title, content,
  coalesce(seo_title, '') as seo_title, coalesce(seo_description, '') as seo_description,
  seo_index, is_published, created_at, updated_at`

function mapRow(r: StaticPageDbRow): PartnerStaticPageRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    slug: r.slug,
    title: r.title ?? '',
    content: r.content ?? '',
    seoTitle: r.seo_title ?? '',
    seoDescription: r.seo_description ?? '',
    seoIndex: r.seo_index !== false,
    isPublished: r.is_published !== false,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  return (e as { code?: string }).code === '23505'
}

/** Trang công khai theo slug — chỉ trả về khi `is_published=true` (dùng cho render trang thật). */
export async function fetchPublishedPartnerStaticPageBySlugFromPg(
  partnerId: string,
  slug: string
): Promise<PartnerStaticPageRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<StaticPageDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_static_pages
       where partner_id = $1::uuid and slug = $2 and is_published = true`,
      [partnerId, slug.trim().toLowerCase()]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[fetchPublishedPartnerStaticPageBySlugFromPg]', e)
    return null
  }
}

/** Một trang tĩnh theo slug — admin (kể cả chưa publish). */
export async function fetchPartnerStaticPageBySlugAdminFromPg(
  partnerId: string,
  slug: string
): Promise<PartnerStaticPageRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<StaticPageDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_static_pages
       where partner_id = $1::uuid and slug = $2`,
      [partnerId, slug.trim().toLowerCase()]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerStaticPageBySlugAdminFromPg]', e)
    return null
  }
}

export async function upsertPartnerStaticPageBySlugFromPg(
  partnerId: string,
  input: UpsertStaticPageInput
): Promise<UpsertStaticPageResult> {
  const slug = input.slug.trim().toLowerCase()
  const existing = await fetchPartnerStaticPageBySlugAdminFromPg(partnerId, slug)
  if (existing) {
    return updatePartnerStaticPageFromPg(partnerId, existing.id, {
      title: input.title,
      content: input.content,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      seoIndex: input.seoIndex,
      isPublished: input.isPublished,
    })
  }
  return insertPartnerStaticPageFromPg(partnerId, {
    ...input,
    isPublished: input.isPublished !== false,
  })
}

/** Toàn bộ trang tĩnh của 1 shop cho admin (gồm cả chưa publish). */
export async function fetchPartnerStaticPagesForAdminFromPg(
  partnerId: string
): Promise<PartnerStaticPageRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<StaticPageDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_static_pages
       where partner_id = $1::uuid
       order by created_at asc`,
      [partnerId]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[fetchPartnerStaticPagesForAdminFromPg]', e)
    return null
  }
}

export type UpsertStaticPageInput = {
  slug: string
  title: string
  content?: string
  seoTitle?: string
  seoDescription?: string
  seoIndex?: boolean
  isPublished?: boolean
}

export type UpsertStaticPageResult =
  | { ok: true; row: PartnerStaticPageRow }
  | { ok: false; error: 'duplicate_slug' | 'invalid_slug' | 'db_error' }

export async function insertPartnerStaticPageFromPg(
  partnerId: string,
  input: UpsertStaticPageInput
): Promise<UpsertStaticPageResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const slug = input.slug.trim().toLowerCase()
  if (!isValidCustomPageSlug(slug)) return { ok: false, error: 'invalid_slug' }
  const title = input.title.trim().slice(0, 200)
  if (!title) return { ok: false, error: 'db_error' }

  try {
    const row = await pgQueryOne<StaticPageDbRow>(
      `insert into public.messaging_partner_static_pages (
        partner_id, slug, title, content, seo_title, seo_description, seo_index, is_published
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
      returning ${SELECT_COLS}`,
      [
        partnerId,
        slug,
        title,
        (input.content ?? '').trim().slice(0, 20000),
        (input.seoTitle ?? '').trim().slice(0, 200),
        (input.seoDescription ?? '').trim().slice(0, 500),
        input.seoIndex !== false,
        input.isPublished !== false,
      ]
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapRow(row) }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'duplicate_slug' }
    console.warn('[insertPartnerStaticPageFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

export async function updatePartnerStaticPageFromPg(
  partnerId: string,
  pageId: string,
  patch: Partial<UpsertStaticPageInput>
): Promise<UpsertStaticPageResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const sets: string[] = []
  const params: unknown[] = [partnerId, pageId]
  let p = 3

  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, 200)
    if (!title) return { ok: false, error: 'db_error' }
    sets.push(`title = $${p++}`)
    params.push(title)
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${p++}`)
    params.push(patch.content.trim().slice(0, 20000))
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
  if (patch.isPublished !== undefined) {
    sets.push(`is_published = $${p++}`)
    params.push(patch.isPublished)
  }
  if (!sets.length) return { ok: false, error: 'db_error' }

  try {
    const row = await pgQueryOne<StaticPageDbRow>(
      `update public.messaging_partner_static_pages
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      params
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapRow(row) }
  } catch (e) {
    console.warn('[updatePartnerStaticPageFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

export async function deletePartnerStaticPageFromPg(partnerId: string, pageId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_static_pages where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, pageId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerStaticPageFromPg]', e)
    return false
  }
}
