/**
 * Ổ CDN Bunny riêng cho từng shop SaaS: Storage Zone + Pull Zone `{slug}.b-cdn.net`.
 * Shop chưa có dòng trong bảng vẫn dùng zone chung (BUNNY_STORAGE_*).
 */
import {
  deletePartnerBunnyCdnRowFromPg,
  fetchPartnerBunnyCdnByHostnameFromPg,
  fetchPartnerBunnyCdnFromPg,
  insertPartnerBunnyCdnFromPg,
  listPartnerBunnyCdnDeletePendingFromPg,
  listPartnersMissingBunnyCdnFromPg,
  markPartnerBunnyCdnDeletePendingFromPg,
  type PartnerBunnyCdnRow,
} from '@/lib/db/messaging-partner-bunny-cdn-pg'
import { LEGACY_BUNNY_PULL_ZONE_HOST } from '@/lib/bunny-cdn-url'
import { partnerBunnyZoneName } from '@/lib/storage/partner-bunny-zone-name'
import {
  buildTryOnEncodedPath,
  deleteBunnyStorageObject,
  platformBunnyStorageAuth,
  uploadBunnyStorageObject,
  type BunnyStorageAuth,
} from '@/lib/storage/try-on-public-upload'

const BUNNY_API = 'https://api.bunny.net'

function accountApiKey(): string {
  return (process.env.BUNNY_ACCOUNT_API_KEY || '').trim()
}

export function partnerBunnyAccountConfigured(): boolean {
  return Boolean(accountApiKey())
}

function storageRegion(): string {
  const region = (process.env.BUNNY_STORAGE_REGION || 'SG').trim().toUpperCase()
  return region || 'SG'
}

function platformZoneName(): string {
  return (process.env.BUNNY_STORAGE_ZONE || '').trim()
}

async function bunnyAccount(path: string, init: RequestInit): Promise<{ status: number; body: string; json: unknown }> {
  const key = accountApiKey()
  if (!key) throw new Error('Thiếu BUNNY_ACCOUNT_API_KEY')
  const res = await fetch(`${BUNNY_API}${path}`, {
    ...init,
    headers: {
      AccessKey: key,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(25_000),
  })
  const body = await res.text().catch(() => '')
  let json: unknown = null
  if (body) {
    try {
      json = JSON.parse(body)
    } catch {
      json = null
    }
  }
  return { status: res.status, body, json }
}

function isNameConflict(status: number, body: string): boolean {
  if (status !== 400 && status !== 409) return false
  return /already|exist|taken|duplicate|unique|in use/i.test(body)
}

function numField(json: unknown, key: string): number | null {
  if (!json || typeof json !== 'object') return null
  const raw = (json as Record<string, unknown>)[key]
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function strField(json: unknown, key: string): string {
  if (!json || typeof json !== 'object') return ''
  return String((json as Record<string, unknown>)[key] ?? '').trim()
}

function authFromRow(row: PartnerBunnyCdnRow): BunnyStorageAuth {
  return {
    zone: row.storageZoneName,
    accessKey: row.storagePassword,
    publicBase: `https://${row.hostname}`,
  }
}

export async function partnerBunnyAuth(partnerId: string): Promise<BunnyStorageAuth | null> {
  const row = await fetchPartnerBunnyCdnFromPg(partnerId)
  if (!row || row.deletePending) return null
  if (!row.storageZoneName || !row.storagePassword || !row.hostname) return null
  return authFromRow(row)
}

export async function partnerBunnyHostname(partnerId: string): Promise<string | null> {
  const auth = await partnerBunnyAuth(partnerId)
  if (!auth) return null
  try {
    return new URL(auth.publicBase).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Upload vào ổ shop nếu đã cấp; không thì zone chung. */
export async function uploadPartnerBunnyObject(
  partnerId: string,
  path: string,
  body: Buffer,
  contentType: string
): Promise<{ publicUrl: string }> {
  const auth = (await partnerBunnyAuth(partnerId)) ?? platformBunnyStorageAuth()
  if (!auth) {
    throw new Error('Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).')
  }
  return uploadBunnyStorageObject(path, body, { contentType }, auth)
}

export async function partnerOrPlatformPublicUrl(partnerId: string, storagePath: string): Promise<string> {
  const auth = (await partnerBunnyAuth(partnerId)) ?? platformBunnyStorageAuth()
  if (!auth) {
    throw new Error('Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).')
  }
  return `${auth.publicBase.replace(/\/$/, '')}/${buildTryOnEncodedPath(storagePath)}`
}

export async function partnerStorageObjectExists(partnerId: string, storagePath: string): Promise<boolean> {
  const url = await partnerOrPlatformPublicUrl(partnerId, storagePath)
  const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(20_000) })
  return res.ok
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function platformHosts(): Set<string> {
  const hosts = new Set<string>()
  const add = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    try {
      hosts.add(new URL(t.includes('://') ? t : `https://${t}`).hostname.toLowerCase())
    } catch {
      /* ignore */
    }
  }
  add(process.env.BUNNY_STORAGE_PUBLIC_BASE_URL || '')
  add(process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL || '')
  add(LEGACY_BUNNY_PULL_ZONE_HOST)
  for (const extra of (process.env.BUNNY_DELETE_EXTRA_HOSTS || '').split(',')) add(extra)
  return hosts
}

export type BunnyDeleteTarget =
  | { kind: 'platform' }
  | { kind: 'partner'; auth: BunnyStorageAuth }
  | { kind: 'gone' }

/** Chọn zone để DELETE object. `gone` = hostname shop đã gỡ ổ. */
export async function resolveBunnyDeleteTarget(sourceUrl: string, partnerId?: string | null): Promise<BunnyDeleteTarget> {
  const host = hostOf(sourceUrl)
  if (!host) return { kind: 'platform' }
  if (partnerId) {
    const row = await fetchPartnerBunnyCdnFromPg(partnerId)
    if (row && row.hostname.toLowerCase() === host) return { kind: 'partner', auth: authFromRow(row) }
  }
  const byHost = await fetchPartnerBunnyCdnByHostnameFromPg(host)
  if (byHost) return { kind: 'partner', auth: authFromRow(byHost) }
  if (host.endsWith('.b-cdn.net') && !platformHosts().has(host) && host !== '188comvn.b-cdn.net') {
    return { kind: 'gone' }
  }
  return { kind: 'platform' }
}

export async function deleteBunnyObjectForSource(
  storagePath: string,
  sourceUrl: string,
  partnerId?: string | null
): Promise<boolean> {
  const target = await resolveBunnyDeleteTarget(sourceUrl, partnerId)
  if (target.kind === 'gone') return true
  if (target.kind === 'partner') return deleteBunnyStorageObject(storagePath, target.auth)
  return deleteBunnyStorageObject(storagePath)
}

async function createStorageZone(name: string): Promise<{ id: number; password: string } | { conflict: true } | { error: string }> {
  const created = await bunnyAccount('/storagezone', {
    method: 'POST',
    body: JSON.stringify({ Name: name, Region: storageRegion() }),
  })
  if (isNameConflict(created.status, created.body)) return { conflict: true }
  if (created.status < 200 || created.status >= 300) {
    return { error: `Bunny storage zone ${created.status}: ${created.body.slice(0, 240)}` }
  }
  const id = numField(created.json, 'Id')
  const password = strField(created.json, 'Password') || strField(created.json, 'password')
  if (!id || !password) return { error: 'Bunny storage zone thiếu Id hoặc Password.' }
  return { id, password }
}

async function createPullZone(name: string, storageZoneId: number): Promise<{ id: number } | { conflict: true } | { error: string }> {
  const payloads = [
    { Name: name, Type: 0, StorageZoneId: storageZoneId },
    { Name: name, Type: 0, StorageZoneId: storageZoneId, OriginUrl: '' },
  ]
  let last = ''
  for (const payload of payloads) {
    const created = await bunnyAccount('/pullzone', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (isNameConflict(created.status, created.body)) return { conflict: true }
    if (created.status >= 200 && created.status < 300) {
      const id = numField(created.json, 'Id')
      if (!id) return { error: 'Bunny pull zone thiếu Id.' }
      return { id }
    }
    last = `Bunny pull zone ${created.status}: ${created.body.slice(0, 240)}`
    if (!/originurl/i.test(created.body)) return { error: last }
  }
  return { error: last || 'Không tạo được pull zone Bunny.' }
}

async function deleteBunnyZone(kind: 'pullzone' | 'storagezone', id: number): Promise<void> {
  const res = await bunnyAccount(`/${kind}/${id}`, { method: 'DELETE' })
  if (res.status === 200 || res.status === 202 || res.status === 204 || res.status === 404) return
  throw new Error(`Bunny DELETE ${kind}/${id} ${res.status}: ${res.body.slice(0, 240)}`)
}

function refusePlatformZone(name: string): boolean {
  const platform = platformZoneName().toLowerCase()
  return Boolean(platform && name.trim().toLowerCase() === platform)
}

export type PartnerBunnyProvisionResult = {
  partnerId: string
  slug: string
  ok: boolean
  error?: string
}

/** Cấp ổ cho shop đã tạo mà chưa có dòng CDN. Một lượt ít shop để khỏi dồn API Bunny. */
export async function provisionMissingPartnerBunnyCdns(limit = 1): Promise<PartnerBunnyProvisionResult[]> {
  if (!partnerBunnyAccountConfigured()) return []
  const pending = await listPartnersMissingBunnyCdnFromPg(limit)
  const out: PartnerBunnyProvisionResult[] = []
  for (const shop of pending) {
    try {
      await provisionPartnerBunnyCdn({ partnerId: shop.partnerId, slug: shop.slug })
      const row = await fetchPartnerBunnyCdnFromPg(shop.partnerId)
      if (row && !row.deletePending) out.push({ partnerId: shop.partnerId, slug: shop.slug, ok: true })
      else out.push({ partnerId: shop.partnerId, slug: shop.slug, ok: false, error: 'Chưa lưu được ổ CDN.' })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.warn('[provisionMissingPartnerBunnyCdns]', shop.partnerId, error)
      out.push({ partnerId: shop.partnerId, slug: shop.slug, ok: false, error })
    }
  }
  return out
}

/** Tạo ổ khi mở shop. Lỗi Bunny không chặn tạo workspace — caller bắt lỗi. */
export async function provisionPartnerBunnyCdn(input: { partnerId: string; slug: string }): Promise<void> {
  if (!partnerBunnyAccountConfigured()) {
    console.warn('[provisionPartnerBunnyCdn] thiếu BUNNY_ACCOUNT_API_KEY — shop dùng CDN chung')
    return
  }
  const existing = await fetchPartnerBunnyCdnFromPg(input.partnerId)
  if (existing) return

  let lastError = 'Không tạo được ổ CDN Bunny.'
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const name = partnerBunnyZoneName({
      slug: input.slug,
      attempt,
      partnerId: input.partnerId,
      platformZoneName: platformZoneName(),
    })
    if (refusePlatformZone(name)) {
      lastError = 'Tên zone trùng ổ CDN nền tảng.'
      continue
    }
    const storage = await createStorageZone(name)
    if ('conflict' in storage) continue
    if ('error' in storage) throw new Error(storage.error)
    const pull = await createPullZone(name, storage.id)
    if ('conflict' in pull || 'error' in pull) {
      await deleteBunnyZone('storagezone', storage.id).catch((e) => {
        console.warn('[provisionPartnerBunnyCdn] rollback storage', e)
      })
      if ('conflict' in pull) continue
      throw new Error(pull.error)
    }
    const saved = await insertPartnerBunnyCdnFromPg({
      partnerId: input.partnerId,
      storageZoneId: storage.id,
      storageZoneName: name,
      storagePassword: storage.password,
      pullZoneId: pull.id,
      hostname: `${name}.b-cdn.net`,
      deletePending: false,
    })
    if (!saved) {
      await deleteBunnyZone('pullzone', pull.id).catch(() => undefined)
      await deleteBunnyZone('storagezone', storage.id).catch(() => undefined)
      throw new Error('Không lưu được ổ CDN shop.')
    }
    return
  }
  throw new Error(lastError)
}

async function destroyRow(row: PartnerBunnyCdnRow): Promise<void> {
  if (refusePlatformZone(row.storageZoneName)) {
    console.error('[destroyPartnerBunnyCdn] từ chối xóa zone nền tảng', row.storageZoneName)
    return
  }
  await markPartnerBunnyCdnDeletePendingFromPg(row.partnerId)
  if (row.pullZoneId > 0) await deleteBunnyZone('pullzone', row.pullZoneId)
  if (row.storageZoneId > 0) await deleteBunnyZone('storagezone', row.storageZoneId)
  await deletePartnerBunnyCdnRowFromPg(row.partnerId)
}

/** Xóa Pull Zone rồi Storage Zone khi shop bị xóa. */
export async function destroyPartnerBunnyCdn(partnerId: string): Promise<boolean> {
  if (!partnerBunnyAccountConfigured()) return false
  const row = await fetchPartnerBunnyCdnFromPg(partnerId)
  if (!row) return false
  await destroyRow(row)
  return true
}

export async function retryPendingPartnerBunnyCdnDeletes(): Promise<number> {
  if (!partnerBunnyAccountConfigured()) return 0
  const rows = await listPartnerBunnyCdnDeletePendingFromPg()
  let n = 0
  for (const row of rows) {
    try {
      await destroyRow(row)
      n += 1
    } catch (e) {
      console.warn('[retryPendingPartnerBunnyCdnDeletes]', row.partnerId, e)
    }
  }
  return n
}
