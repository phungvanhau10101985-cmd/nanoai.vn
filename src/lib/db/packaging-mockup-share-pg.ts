import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { WebLocale } from '@/lib/i18n/config'
import type { BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import {
  isBagDimensionsMm,
  isBoxDimensionsMm,
  type PackagingMockupKind,
} from '@/lib/packaging/mockup-share-utils'

export type PackagingMockupShareRow =
  | {
      mockup_kind: 'box'
      dimensions_mm: BoxDimensionsMm
      face_urls: Partial<Record<BoxFaceSlot, string>>
      locale: WebLocale
    }
  | {
      mockup_kind: 'bag'
      dimensions_mm: BagDimensionsMm
      face_urls: Partial<Record<BagFaceSlot, string>>
      locale: WebLocale
    }

export async function insertPackagingMockupSharePg(input: {
  shareToken: string
  userId: string | null
  mockupKind: PackagingMockupKind
  dimensionsMm: BoxDimensionsMm | BagDimensionsMm
  faceUrls: Partial<Record<BoxFaceSlot | BagFaceSlot, string>>
  locale: WebLocale
  expiresAtIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.packaging_mockup_shares (
         share_token, user_id, mockup_kind, dimensions_mm, face_urls, locale, expires_at
       ) values ($1, $2::uuid, $3, $4::jsonb, $5::jsonb, $6, $7::timestamptz)`,
      [
        input.shareToken,
        input.userId,
        input.mockupKind,
        JSON.stringify(input.dimensionsMm),
        JSON.stringify(input.faceUrls),
        input.locale,
        input.expiresAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[packaging-mockup-share-pg] insertPackagingMockupSharePg', e)
    return null
  }
}

export async function fetchPackagingMockupShareByTokenPg(
  shareToken: string
): Promise<PackagingMockupShareRow | null> {
  if (!isPgConfigured()) return null
  const token = shareToken.trim()
  if (!token) return null
  try {
    const row = await pgQueryOne<{
      mockup_kind: string | null
      dimensions_mm: unknown
      face_urls: unknown
      locale: string | null
    }>(
      `select mockup_kind, dimensions_mm, face_urls, locale
       from public.packaging_mockup_shares
       where share_token = $1 and expires_at > timezone('utc'::text, now())
       limit 1`,
      [token]
    )
    if (!row) return null
    const locale = (row.locale ?? 'vi') as WebLocale
    const faceRaw = row.face_urls
    const face_urls =
      faceRaw && typeof faceRaw === 'object' && !Array.isArray(faceRaw)
        ? (faceRaw as Partial<Record<BoxFaceSlot | BagFaceSlot, string>>)
        : {}

    const mockupKind = row.mockup_kind === 'bag' ? 'bag' : 'box'
    if (mockupKind === 'bag' && isBagDimensionsMm(row.dimensions_mm)) {
      return {
        mockup_kind: 'bag',
        dimensions_mm: row.dimensions_mm,
        face_urls: face_urls as Partial<Record<BagFaceSlot, string>>,
        locale,
      }
    }
    if (isBoxDimensionsMm(row.dimensions_mm)) {
      return {
        mockup_kind: 'box',
        dimensions_mm: row.dimensions_mm,
        face_urls: face_urls as Partial<Record<BoxFaceSlot, string>>,
        locale,
      }
    }
    return null
  } catch (e) {
    console.error('[packaging-mockup-share-pg] fetchPackagingMockupShareByTokenPg', e)
    return null
  }
}
