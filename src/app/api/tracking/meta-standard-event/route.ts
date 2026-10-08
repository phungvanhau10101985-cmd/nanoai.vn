import { NextRequest, NextResponse } from 'next/server'
import { loadAdminIntegrationsValueJsonByKey } from '@/lib/db/admin-integrations-settings-pg'

export const dynamic = 'force-dynamic'

const INTEGRATIONS_KEY = 'admin_integrations_config'
const GRAPH_VERSION = 'v21.0'

type MetaStandardEventName =
  | 'CompleteRegistration'
  | 'StartTrial'
  | 'Subscribe'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'

type CustomScalar = string | number | boolean
type CustomValue = CustomScalar | CustomScalar[] | Array<Record<string, CustomScalar>>

type AdminIntegrationsSettings = {
  facebookPixelId?: string
  facebookCapiAccessToken?: string
  facebookDatasetId?: string
  facebookTestEventCode?: string
}

function clientIpFromRequest(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first && /^[\d.:a-fA-Fx]+$/.test(first)) return first
  }
  const xr = request.headers.get('x-real-ip')?.trim()
  if (xr && /^[\d.:a-fA-Fx]+$/.test(xr)) return xr
  return null
}

function sanitizeScalar(raw: unknown, maxLen: number): CustomScalar | null {
  if (typeof raw === 'string') return raw.slice(0, maxLen)
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'boolean') return raw
  return null
}

function sanitizeCustomData(input: unknown): Record<string, CustomValue> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Record<string, CustomValue> = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const k = key.trim().slice(0, 80)
    if (!k) continue
    const scalar = sanitizeScalar(raw, 1000)
    if (scalar !== null && !Array.isArray(raw)) {
      out[k] = scalar
      continue
    }
    if (!Array.isArray(raw)) continue
    const objectRows = raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    if (objectRows.length > 0 && objectRows.length === raw.length) {
      const rows = objectRows
        .slice(0, 20)
        .map((item) => {
          const row: Record<string, CustomScalar> = {}
          for (const [innerKey, innerRaw] of Object.entries(item as Record<string, unknown>)) {
            const ik = innerKey.trim().slice(0, 40)
            const iv = sanitizeScalar(innerRaw, 200)
            if (ik && iv !== null) row[ik] = iv
          }
          return row
        })
        .filter((row) => Object.keys(row).length > 0)
      if (rows.length > 0) out[k] = rows
      continue
    }
    const arr = raw
      .map((item) => sanitizeScalar(item, 200))
      .filter((item): item is CustomScalar => item !== null)
      .slice(0, 50)
    if (arr.length > 0) out[k] = arr
  }
  return out
}

function readString(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim()
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const eventNameRaw = readString(body, 'eventName')
  const eventId = readString(body, 'eventId')
  const eventSourceUrl = readString(body, 'eventSourceUrl').slice(0, 2000)
  const fbc = readString(body, 'fbc')
  const fbp = readString(body, 'fbp')
  const allowedEvents: MetaStandardEventName[] = [
    'CompleteRegistration',
    'StartTrial',
    'Subscribe',
    'ViewContent',
    'AddToCart',
    'InitiateCheckout',
    'Purchase',
  ]
  if (!allowedEvents.includes(eventNameRaw as MetaStandardEventName)) {
    return NextResponse.json({ ok: false, error: 'invalid_event_name' }, { status: 400 })
  }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(eventId)) {
    return NextResponse.json({ ok: false, error: 'invalid_event_id' }, { status: 400 })
  }
  if (!eventSourceUrl) {
    return NextResponse.json({ ok: false, error: 'missing_event_source_url' }, { status: 400 })
  }

  const settingsRaw = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY)
  const settings =
    settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)
      ? (settingsRaw as AdminIntegrationsSettings)
      : {}
  const pixelId = String(settings.facebookPixelId ?? '').trim()
  const token = String(settings.facebookCapiAccessToken ?? '').trim()
  const testEventCode = String(settings.facebookTestEventCode ?? '').trim()
  const datasetId = String(settings.facebookDatasetId ?? '').trim()

  if (!pixelId || !token) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'missing_pixel_or_token' })
  }

  const user_data: Record<string, string> = {}
  const ip = clientIpFromRequest(request)
  if (ip) user_data.client_ip_address = ip
  const ua = request.headers.get('user-agent')?.trim()
  if (ua) user_data.client_user_agent = ua.slice(0, 512)
  if (/^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(fbc)) user_data.fbc = fbc
  if (/^fb\.1\.\d+\.\d+$/.test(fbp)) user_data.fbp = fbp

  const custom_data = sanitizeCustomData(body.customData)
  if (datasetId) {
    custom_data.dataset_id = datasetId.slice(0, 128)
  }

  const graphUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: eventNameRaw,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data,
        custom_data,
      },
    ],
    access_token: token,
  }
  if (testEventCode) payload.test_event_code = testEventCode

  try {
    const res = await fetch(graphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    if (!res.ok) {
      const error = json?.error?.message || res.statusText || 'capi_error'
      return NextResponse.json({ ok: false, error }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'fetch_failed'
    return NextResponse.json({ ok: false, error }, { status: 502 })
  }
}
