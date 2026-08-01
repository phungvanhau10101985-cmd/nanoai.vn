import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { insertPackagingMockupSharePg } from '@/lib/db/packaging-mockup-share-pg'
import { getUserForCreditAction } from '@/lib/auth'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { normalizeBagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import {
  PACKAGING_MOCKUP_SHARE_EXPIRY_DAYS,
  buildPackagingMockupShareUrl,
  generatePackagingMockupShareToken,
  resolveBagFaceUrlsForShare,
  resolveMockupFaceUrlsForShare,
  type BagMockupFaceSlotsInput,
  type MockupFaceSlotsInput,
  type PackagingMockupKind,
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
      mockupKind?: PackagingMockupKind
      dimensionsMm?: BoxDimensionsMm | Record<string, number>
      faceSlots?: MockupFaceSlotsInput | BagMockupFaceSlotsInput
      locale?: string
    }

    const mockupKind: PackagingMockupKind = body.mockupKind === 'bag' ? 'bag' : 'box'
    const locale = normalizeWebLocale(body.locale) ?? ('vi' as WebLocale)
    const shareToken = generatePackagingMockupShareToken()
    const expiresAt = new Date(
      Date.now() + PACKAGING_MOCKUP_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    )

    if (mockupKind === 'bag') {
      const dimensionsMm = normalizeBagDimensionsMm(body.dimensionsMm)
      if (!dimensionsMm) {
        return NextResponse.json({ error: 'dimensionsMm required' }, { status: 400 })
      }
      const faceSlots = (body.faceSlots ?? {}) as BagMockupFaceSlotsInput
      const faceUrls = resolveBagFaceUrlsForShare(faceSlots)
      if (Object.keys(faceUrls).length === 0) {
        return NextResponse.json({ error: 'faceSlots required' }, { status: 400 })
      }
      const ok = await insertPackagingMockupSharePg({
        shareToken,
        userId: auth.user.id,
        mockupKind: 'bag',
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
        mockupKind: 'bag',
        expiresAt: expiresAt.toISOString(),
      })
    }

    const dimensionsMm = body.dimensionsMm as BoxDimensionsMm | undefined
    if (
      !dimensionsMm ||
      typeof dimensionsMm.length !== 'number' ||
      typeof dimensionsMm.width !== 'number' ||
      typeof dimensionsMm.height !== 'number'
    ) {
      return NextResponse.json({ error: 'dimensionsMm required' }, { status: 400 })
    }

    const faceSlots = (body.faceSlots ?? {}) as MockupFaceSlotsInput
    const faceUrls = resolveMockupFaceUrlsForShare(faceSlots)
    if (Object.keys(faceUrls).length === 0) {
      return NextResponse.json({ error: 'faceSlots required' }, { status: 400 })
    }

    const ok = await insertPackagingMockupSharePg({
      shareToken,
      userId: auth.user.id,
      mockupKind: 'box',
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
      mockupKind: 'box',
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
