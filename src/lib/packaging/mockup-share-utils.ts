import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import {
  resolveBagFacePreviewUrl,
  type BagFaceSlot,
} from '@/lib/hub-chat/bag-kit-shared'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import {
  BOX_FACE_SLOT_ORDER,
  resolveMockupSlotUrl,
  type BoxFaceSlot,
  type FaceSourceMode,
} from '@/lib/packaging/box-face-slots'

export type PackagingMockupKind = 'box' | 'bag'

export const PACKAGING_MOCKUP_SHARE_EXPIRY_DAYS = 30

export function generatePackagingMockupShareToken(): string {
  return randomBytes(6).toString('base64url').slice(0, 10)
}

export function packagingMockupSharePath(token: string): string {
  return `/share/mockup/${encodeURIComponent(token)}`
}

export function mockupDownloadFilename(dimensionsMm: {
  length: number
  width: number
  height: number
}): string {
  const l = Math.round(dimensionsMm.length)
  const w = Math.round(dimensionsMm.width)
  const h = Math.round(dimensionsMm.height)
  return `box-mockup-${l}x${w}x${h}mm`
}

export function bagMockupDownloadFilename(dimensionsMm: BagDimensionsMm): string {
  const w = Math.round(dimensionsMm.width)
  const h = Math.round(dimensionsMm.height)
  const g = Math.round(dimensionsMm.gusset)
  return `bag-mockup-${w}x${h}x${g}mm`
}

/** Resolve absolute share URL from request (production-safe). */
export function getPackagingMockupShareBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const effectiveProto = proto === 'on' || proto === 'https' ? 'https' : proto
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${effectiveProto}://${host}`.replace(/\/$/, '')
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'production') {
    return (envUrl || defaultPublicOrigin()).replace(/\/$/, '')
  }
  return req.nextUrl.origin
}

export function buildPackagingMockupShareUrl(req: NextRequest, token: string): string {
  return `${getPackagingMockupShareBaseUrl(req)}${packagingMockupSharePath(token)}`
}

export type MockupFaceSlotsInput = Partial<
  Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>
>

/** Store resolved CDN URLs per slot for public viewers. */
export function resolveMockupFaceUrlsForShare(
  faceSlots: MockupFaceSlotsInput
): Partial<Record<BoxFaceSlot, string>> {
  const out: Partial<Record<BoxFaceSlot, string>> = {}
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const url = resolveMockupSlotUrl(slot, faceSlots)
    if (url) out[slot] = url
  }
  return out
}

export function faceUrlsToFaceSlots(
  faceUrls: Partial<Record<BoxFaceSlot, string>>
): MockupFaceSlotsInput {
  const out: MockupFaceSlotsInput = {}
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const url = faceUrls[slot]
    if (url) out[slot] = { sourceMode: 'generate', url }
  }
  return out
}

export type BagMockupFaceSlotsInput = Partial<
  Record<BagFaceSlot, { sourceMode: string; url?: string }>
>

export function resolveBagFaceUrlsForShare(
  faceSlots: BagMockupFaceSlotsInput
): Partial<Record<BagFaceSlot, string>> {
  const out: Partial<Record<BagFaceSlot, string>> = {}
  for (const slot of ['back', 'front'] as const) {
    const url = resolveBagFacePreviewUrl({ faceSlots }, slot)
    if (url) out[slot] = url
  }
  return out
}

export function bagFaceUrlsToFaceSlots(
  faceUrls: Partial<Record<BagFaceSlot, string>>
): BagMockupFaceSlotsInput {
  const out: BagMockupFaceSlotsInput = {}
  for (const slot of ['back', 'front'] as const) {
    const url = faceUrls[slot]
    if (url) out[slot] = { sourceMode: 'generate', url }
  }
  return out
}

export function isBagDimensionsMm(raw: unknown): raw is BagDimensionsMm {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return (
    typeof o.width === 'number' &&
    typeof o.height === 'number' &&
    typeof o.gusset === 'number' &&
    !('length' in o)
  )
}

export function isBoxDimensionsMm(raw: unknown): raw is {
  length: number
  width: number
  height: number
} {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return typeof o.length === 'number' && typeof o.width === 'number' && typeof o.height === 'number'
}
