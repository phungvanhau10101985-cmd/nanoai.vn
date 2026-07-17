import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'

export type PackagingMockupShareRow = {
  dimensions_mm: BoxDimensionsMm
  face_urls: Partial<Record<BoxFaceSlot, string>>
  locale: WebLocale
}

export async function insertPackagingMockupSharePg(input: {
  shareToken: string
  userId: string | null
  dimensionsMm: BoxDimensionsMm
  faceUrls: Partial<Record<BoxFaceSlot, string>>
  locale: WebLocale
  expiresAtIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.packaging_mockup_shares (
         share_token, user_id, dimensions_mm, face_urls, locale, expires_at
       ) values ($1, $2::uuid, $3::jsonb, $4::jsonb, $5, $6::timestamptz)`,
      [
        input.shareToken,
        input.userId,
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
      dimensions_mm: unknown
      face_urls: unknown
      locale: string | null
    }>(
      `select dimensions_mm, face_urls, locale
       from public.packaging_mockup_shares
       where share_token = $1 and expires_at > timezone('utc'::text, now())
       limit 1`,
      [token]
    )
    if (!row) return null
    const dimensionsRaw = row.dimensions_mm
    const faceRaw = row.face_urls
    if (
      !dimensionsRaw ||
      typeof dimensionsRaw !== 'object' ||
      !('length' in dimensionsRaw) ||
      !('width' in dimensionsRaw) ||
      !('height' in dimensionsRaw)
    ) {
      return null
    }
    const dimensions_mm = dimensionsRaw as BoxDimensionsMm
    const face_urls =
      faceRaw && typeof faceRaw === 'object' && !Array.isArray(faceRaw)
        ? (faceRaw as Partial<Record<BoxFaceSlot, string>>)
        : {}
    const locale = (row.locale ?? 'vi') as WebLocale
    return { dimensions_mm, face_urls, locale }
  } catch (e) {
    console.error('[packaging-mockup-share-pg] fetchPackagingMockupShareByTokenPg', e)
    return null
  }
}
