import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import type { LandingPageSection } from '@/lib/hub-chat/landing-page-sections'

export const HUB_LANDING_SHARE_EXPIRY_DAYS = 90

export function generateHubLandingShareToken(): string {
  return randomBytes(6).toString('base64url').slice(0, 10)
}

export function hubLandingSharePath(token: string): string {
  return `/share/landing/${encodeURIComponent(token)}`
}

export function getHubLandingShareBaseUrl(req: NextRequest): string {
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

export function buildHubLandingShareUrl(req: NextRequest, token: string): string {
  return `${getHubLandingShareBaseUrl(req)}${hubLandingSharePath(token)}`
}

export type LandingPageSharePayload = {
  title: string
  logoUrl?: string | null
  sections: LandingPageSection[]
  htmlSource?: string | null
}

export function normalizeLandingShareSections(raw: unknown): LandingPageSection[] {
  if (!Array.isArray(raw)) return []
  const out: LandingPageSection[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const key = String((row as { key?: string }).key ?? '').trim()
    const url = String((row as { url?: string }).url ?? '').trim()
    if (!key || !url) continue
    out.push({
      key: key as LandingPageSection['key'],
      label: String((row as { label?: string }).label ?? key),
      url,
      formFactor: (row as { formFactor?: LandingPageSection['formFactor'] }).formFactor,
    })
  }
  return out
}
