import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { insertPackagingMockupSharePg } from '@/lib/db/packaging-mockup-share-pg'
import { getUserForCreditAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import {
  PACKAGING_MOCKUP_SHARE_EXPIRY_DAYS,
  buildPackagingMockupShareUrl,
  generatePackagingMockupShareToken,
  resolveMockupFaceUrlsForShare,
  type MockupFaceSlotsInput,
} from '@/lib/packaging/mockup-share-utils'

export async function POST(req: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }

    const auth = await getUserForCreditAction()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = (await req.json()) as {
      dimensionsMm?: BoxDimensionsMm
      faceSlots?: MockupFaceSlotsInput
      locale?: string
    }

    const dimensionsMm = body.dimensionsMm
    if (
      !dimensionsMm ||
      typeof dimensionsMm.length !== 'number' ||
      typeof dimensionsMm.width !== 'number' ||
      typeof dimensionsMm.height !== 'number'
    ) {
      return NextResponse.json({ error: 'dimensionsMm required' }, { status: 400 })
    }

    const faceSlots = body.faceSlots ?? {}
    const faceUrls = resolveMockupFaceUrlsForShare(faceSlots)
    if (Object.keys(faceUrls).length === 0) {
      return NextResponse.json({ error: 'faceSlots required' }, { status: 400 })
    }

    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const shareToken = generatePackagingMockupShareToken()
    const expiresAt = new Date(
      Date.now() + PACKAGING_MOCKUP_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    )

    const ok = await insertPackagingMockupSharePg({
      shareToken,
      userId: auth.user.id,
      dimensionsMm,
      faceUrls,
      locale,
      expiresAtIso: expiresAt.toISOString(),
    })

    if (ok !== true) {
      return NextResponse.json({ error: 'Could not create share link' }, { status: 500 })
    }

    const shareUrl = buildPackagingMockupShareUrl(req, shareToken)
    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
