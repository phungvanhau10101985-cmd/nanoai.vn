import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import { dedicatedRatingGroupId } from '@/lib/partner-website/category/partner-category-rating-group'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import { seedReviewsForNewRatingGroup } from '@/lib/partner-website/category/partner-category-seed-reviews'

/**
 * Import kho: sản phẩm nhận nhóm đánh giá của danh mục cấp 3.
 * Mã đã có đánh giá import là nhóm dùng chung (không gắn vào một danh mục).
 * Mã chưa có đánh giá thì gắn vào cat3 và sinh 100 đánh giá dựng sẵn.
 */

export type ImportRatingDecision =
  | { kind: 'adopt'; groupId: number }
  | { kind: 'assign'; groupId: number }
  | { kind: 'seed-owner'; groupId: number; ownerCategoryId: string }
  | { kind: 'unchanged' }

export function planImportCategoryRating(input: {
  fileGroupId: number
  categoryId: string
  categoryRatingGroupId: number | null | undefined
  groupsWithReviews: ReadonlySet<number>
  ownerCategoryId: string | null
}): ImportRatingDecision {
  const onCategory = Math.round(Number(input.categoryRatingGroupId) || 0)
  if (onCategory > 0) return { kind: 'adopt', groupId: onCategory }
  const dedicated = dedicatedRatingGroupId(input.fileGroupId)
  if (!dedicated || input.groupsWithReviews.has(dedicated)) return { kind: 'unchanged' }
  if (input.ownerCategoryId && input.ownerCategoryId !== input.categoryId) {
    return { kind: 'seed-owner', groupId: dedicated, ownerCategoryId: input.ownerCategoryId }
  }
  return { kind: 'assign', groupId: dedicated }
}

export function categoryPathNames(
  rows: PartnerCategoryRow[],
  leaf: PartnerCategoryRow,
  fallback: { cat1: string; cat2: string; cat3: string }
): { cat1: string; cat2: string; cat3: string } {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const cat2 = leaf.parentId ? byId.get(leaf.parentId) : undefined
  const cat1 = cat2?.parentId ? byId.get(cat2.parentId) : undefined
  return {
    cat1: cat1?.name?.trim() || fallback.cat1,
    cat2: cat2?.name?.trim() || fallback.cat2,
    cat3: leaf.name?.trim() || fallback.cat3,
  }
}

export async function loadImportedReviewGroupIds(): Promise<Set<number>> {
  if (!isPgConfigured()) return new Set()
  try {
    const rows = await pgQuery<{ gid: number }>(
      `select distinct import_group as gid
       from public.messaging_partner_product_reviews
       where coalesce(is_imported, false) = true
         and import_group > 0`
    )
    return new Set(rows.map((row) => Math.round(Number(row.gid) || 0)).filter((gid) => gid > 0))
  } catch (e) {
    console.warn('[loadImportedReviewGroupIds]', e)
    return new Set()
  }
}

export async function seedImportedRatingGroup(input: {
  partnerId: string
  groupId: number
  cat1: string
  cat2: string
  cat3: string
  shopName: string
}): Promise<number> {
  return seedReviewsForNewRatingGroup(input)
}
