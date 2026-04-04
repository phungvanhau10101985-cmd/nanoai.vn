/**
 * Google Cloud Vision — Product Search: đồng bộ catalog (GCS + import) và tìm theo ảnh.
 */

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { getGoogleAccessToken, readGcpProjectIdFromEnvOrCredentials } from '@/lib/google-sa-token'
import { trackApiUsage } from '@/lib/track-ai-usage'
import {
  VISION_CATALOG_SYNC_MAX_ITEMS,
  VISION_INCREMENTAL_BATCH_SIZE,
  VISION_INCREMENTAL_MAX_DIRTY_PER_REQUEST,
  VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST,
  VISION_INCREMENTAL_MAX_SCAN_PAGES,
  VISION_INCREMENTAL_SCAN_PAGE,
  VISION_PRODUCT_CATEGORIES,
  type VisionProductCategory,
} from '@/lib/messaging/partner-vision-constants'

type Db = SupabaseClient<Database>
type AiSettings = Database['public']['Tables']['messaging_partner_ai_settings']['Row']
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const VISION_SCOPE = 'https://www.googleapis.com/auth/cloud-vision'
const STORAGE_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write'

export type { VisionProductCategory }
export { VISION_CATALOG_SYNC_MAX_ITEMS, VISION_PRODUCT_CATEGORIES }

export type VisionSearchCandidate = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  /** URL trang sản phẩm trên web shop (nếu đã nhập trong kho). */
  product_url?: string
  score?: number
}

export type GuestMessageVisionPayload = {
  vision_candidates?: VisionSearchCandidate[]
  vision_pick_required?: boolean
  vision_search_error?: string
  vision_selected_inventory_id?: string
  vision_selected_product_label?: string
}

function visionScopesToken(): Promise<string> {
  return getGoogleAccessToken([VISION_SCOPE, STORAGE_SCOPE])
}

export function visionProductSetIdForPartner(partnerId: string): string {
  return `ps${partnerId.replace(/-/g, '')}`
}

export function visionProductIdForInventory(inventoryId: string): string {
  return `inv${inventoryId.replace(/-/g, '')}`
}

function parseVisionProductIdToInventoryId(pid: string): string | null {
  const p = pid.trim()
  if (!p.startsWith('inv') || p.length < 35) return null
  const hex = p.slice(3)
  if (!/^[a-f0-9]{32}$/i.test(hex)) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function gcsUri(bucket: string, object: string): string {
  return `gs://${bucket.replace(/^\/+|\/+$/g, '')}/${object.replace(/^\/+/, '')}`
}

function escapeCsvField(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function uploadBytesToGcs(
  bucket: string,
  objectName: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const token = await visionScopesToken()
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`GCS upload failed (${res.status}): ${t.slice(0, 400)}`)
  }
}

async function visionAuthorizedDelete(url: string): Promise<void> {
  const token = await getGoogleAccessToken([VISION_SCOPE])
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404 || res.status === 204) return
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vision DELETE ${url} failed (${res.status}): ${t.slice(0, 300)}`)
  }
}

async function visionAuthorizedGet(url: string): Promise<Response> {
  const token = await getGoogleAccessToken([VISION_SCOPE])
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
}

async function ensureVisionProductSet(
  projectId: string,
  location: string,
  productSetId: string,
  displayName: string
): Promise<void> {
  const base = `https://vision.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}`
  const url = `${base}/productSets/${encodeURIComponent(productSetId)}`
  const res = await visionAuthorizedGet(url)
  if (res.ok) return
  if (res.status !== 404) {
    const t = await res.text()
    throw new Error(`Vision productSet GET failed (${res.status}): ${t.slice(0, 300)}`)
  }
  const token = await getGoogleAccessToken([VISION_SCOPE])
  const createUrl = `${base}/productSets?productSetId=${encodeURIComponent(productSetId)}`
  const cr = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: displayName.slice(0, 256) }),
  })
  if (!cr.ok && cr.status !== 409) {
    const t = await cr.text()
    throw new Error(`Vision productSet CREATE failed (${cr.status}): ${t.slice(0, 400)}`)
  }
}

/** Xóa một product Vision theo id kho (UUID). */
export async function deleteVisionProductForInventory(
  projectId: string,
  location: string,
  inventoryId: string
): Promise<void> {
  const pid = visionProductIdForInventory(inventoryId)
  const base = `https://vision.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}`
  const url = `${base}/products/${encodeURIComponent(pid)}`
  await visionAuthorizedDelete(url)
}

/**
 * Khi xóa dòng kho: gỡ product tương ứng trên Vision (nếu có).
 * Không throw — không được chặn xóa kho khi Vision/GCP lỗi.
 */
export async function tryDeleteVisionProductForInventoryItem(
  db: Db,
  partnerId: string,
  inventoryId: string
): Promise<void> {
  const projectId = readGcpProjectIdFromEnvOrCredentials()
  if (!projectId) return
  const { data: settings } = await db
    .from('messaging_partner_ai_settings')
    .select('vision_location')
    .eq('partner_id', partnerId)
    .maybeSingle()
  const loc = settings?.vision_location?.trim() || 'us-east1'
  try {
    await deleteVisionProductForInventory(projectId, loc, inventoryId)
  } catch {
    /* chưa từng index hoặc đã xóa */
  }
}

async function postProductSetImport(
  projectId: string,
  location: string,
  csvGsUri: string
): Promise<string> {
  const token = await getGoogleAccessToken([VISION_SCOPE])
  const url = `https://vision.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/productSets:import`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputConfig: { gcsSource: { csvFileUri: csvGsUri } },
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vision productSets:import failed (${res.status}): ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as { name?: string }
  if (!data.name) throw new Error('Vision import: missing operation name')
  return data.name
}

async function pollVisionOperation(operationName: string): Promise<void> {
  const token = await getGoogleAccessToken([VISION_SCOPE])
  const url = `https://vision.googleapis.com/v1/${operationName}`
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Vision operation poll failed (${res.status}): ${t.slice(0, 400)}`)
    }
    const data = (await res.json()) as { done?: boolean; error?: { message?: string } }
    if (data.error?.message) throw new Error(`Vision import operation: ${data.error.message}`)
    if (data.done) return
    await new Promise((r) => setTimeout(r, 2500))
  }
  throw new Error('Vision import: operation timeout')
}

async function fetchImageBytesFromUrl(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25_000) })
    if (!res.ok) return null
    const ct = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32 || buf.length > 20 * 1024 * 1024) return null
    return { buf, contentType: ct }
  } catch {
    return null
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'jpg'
}

export function resolveVisionCatalogBucket(settings: AiSettings): string | null {
  const fromRow = settings.vision_gcs_bucket?.trim()
  if (fromRow) return fromRow
  const env = process.env.GCS_VISION_CATALOG_BUCKET?.trim()
  return env || null
}

export function catalogFingerprintForVisionRow(row: { image_url?: string | null; name?: string | null }): string {
  return createHash('sha256')
    .update(`${(row.image_url ?? '').trim()}\n${(row.name ?? '').trim()}`, 'utf8')
    .digest('hex')
}

function isVisionCatalogRowDirty(row: InvRow): boolean {
  if (row.vision_catalog_excluded) return false
  const url = row.image_url?.trim() ?? ''
  const valid = !!(url && /^https?:\/\//i.test(url))
  if (!valid) return !!row.vision_catalog_checksum
  return row.vision_catalog_checksum !== catalogFingerprintForVisionRow(row)
}

export type VisionCatalogSyncOk = {
  ok: true
  imported: number
  removed: number
  importBatches: number
  lastScannedId: string | null
  inventoryScanExhausted: boolean
  hasMore: boolean
}

const INVENTORY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Mỗi dòng: UUID kho hoặc SKU (cột đầu nếu CSV). Dòng trống và # bị bỏ qua. */
export function parseVisionCatalogPurgeLines(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of raw.split(/\r?\n/)) {
    let s = line.trim()
    if (!s || s.startsWith('#')) continue
    const comma = s.indexOf(',')
    if (comma >= 0) s = s.slice(0, comma).trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export async function runVisionCatalogSync(
  db: Db,
  partnerId: string,
  settings: AiSettings,
  opts?: { resumeAfterId?: string | null }
): Promise<VisionCatalogSyncOk | { error: string }> {
  const markFail = async (msg: string): Promise<{ error: string }> => {
    const now = new Date().toISOString()
    await db
      .from('messaging_partner_ai_settings')
      .update({
        vision_index_ready: false,
        vision_index_error: msg.slice(0, 2000),
        updated_at: now,
      })
      .eq('partner_id', partnerId)
    return { error: msg }
  }

  const projectId = readGcpProjectIdFromEnvOrCredentials()
  if (!projectId) return markFail('Missing GOOGLE_CLOUD_PROJECT_ID or project_id in credentials.')

  const bucket = resolveVisionCatalogBucket(settings)
  if (!bucket) return markFail('Configure GCS_VISION_CATALOG_BUCKET or shop bucket override.')

  const loc = settings.vision_location?.trim() || 'us-east1'
  const category = (settings.vision_product_category?.trim() || 'general-v1') as VisionProductCategory
  if (!VISION_PRODUCT_CATEGORIES.includes(category)) {
    return markFail('Invalid vision product category.')
  }

  const productSetId = visionProductSetIdForPartner(partnerId)
  const prefix = `vision-catalog/${partnerId.replace(/[^a-z0-9-]/gi, '')}`
  const resume = opts?.resumeAfterId?.trim() || null

  let scanCursor: string | null = resume
  let inventoryScanExhausted = false
  const toImport: InvRow[] = []
  const toRemove: InvRow[] = []

  scan: for (let _p = 0; _p < VISION_INCREMENTAL_MAX_SCAN_PAGES; _p += 1) {
    let q = db
      .from('messaging_partner_inventory')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('vision_catalog_excluded', false)
      .order('id', { ascending: true })
      .limit(VISION_INCREMENTAL_SCAN_PAGE)
    if (scanCursor) q = q.gt('id', scanCursor)
    const { data: page, error: pageErr } = await q
    if (pageErr) return markFail(pageErr.message)
    if (!page?.length) {
      inventoryScanExhausted = true
      break scan
    }
    for (const row of page as InvRow[]) {
      scanCursor = row.id
      if (!isVisionCatalogRowDirty(row)) continue
      const url = row.image_url?.trim() ?? ''
      const valid = !!(url && /^https?:\/\//i.test(url))
      if (!valid) {
        if (row.vision_catalog_checksum) toRemove.push(row)
      } else {
        toImport.push(row)
      }
      if (toImport.length + toRemove.length >= VISION_INCREMENTAL_MAX_DIRTY_PER_REQUEST) {
        break scan
      }
    }
    if (page.length < VISION_INCREMENTAL_SCAN_PAGE) {
      inventoryScanExhausted = true
      break scan
    }
  }

  const lastScannedId = scanCursor
  const hitDirtyCap = toImport.length + toRemove.length >= VISION_INCREMENTAL_MAX_DIRTY_PER_REQUEST
  const hasMore = hitDirtyCap || !inventoryScanExhausted

  const bumpAiOk = async () => {
    const now = new Date().toISOString()
    await db
      .from('messaging_partner_ai_settings')
      .update({
        vision_index_ready: true,
        vision_index_synced_at: now,
        vision_index_error: '',
        updated_at: now,
      })
      .eq('partner_id', partnerId)
  }

  try {
    let removed = 0
    for (const row of toRemove) {
      try {
        await deleteVisionProductForInventory(projectId, loc, row.id)
      } catch {
        /* product may already be gone */
      }
      const now = new Date().toISOString()
      const { error: upErr } = await db
        .from('messaging_partner_inventory')
        .update({
          vision_catalog_checksum: null,
          vision_catalog_synced_at: null,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('partner_id', partnerId)
      if (!upErr) removed += 1
    }

    let imported = 0
    let importBatches = 0
    let ensureSet = false

    const importSlices: InvRow[][] = []
    for (let i = 0; i < toImport.length; i += VISION_INCREMENTAL_BATCH_SIZE) {
      importSlices.push(toImport.slice(i, i + VISION_INCREMENTAL_BATCH_SIZE))
    }
    const slicesToRun = importSlices.slice(0, VISION_INCREMENTAL_MAX_IMPORTS_PER_REQUEST)

    for (const slice of slicesToRun) {
      const lines: string[] = []
      const ok: { id: string; fp: string }[] = []
      for (const row of slice) {
        const url = row.image_url?.trim() ?? ''
        const got = await fetchImageBytesFromUrl(url)
        if (!got) continue
        const ext = extFromContentType(got.contentType)
        const imageId = `ref_${visionProductIdForInventory(row.id)}_0`
        const objectPath = `${prefix}/refs/${imageId}.${ext}`
        await uploadBytesToGcs(bucket, objectPath, got.buf, got.contentType)
        const gs = gcsUri(bucket, objectPath)
        const pid = visionProductIdForInventory(row.id)
        const display = row.name?.trim() || pid
        lines.push(
          [
            escapeCsvField(gs),
            escapeCsvField(imageId),
            escapeCsvField(productSetId),
            escapeCsvField(pid),
            category,
            escapeCsvField(display),
            '',
            '',
          ].join(',')
        )
        ok.push({ id: row.id, fp: catalogFingerprintForVisionRow(row) })
      }

      if (lines.length === 0) continue

      if (!ensureSet) {
        await ensureVisionProductSet(projectId, loc, productSetId, `partner-${partnerId.slice(0, 8)}`)
        ensureSet = true
      }

      importBatches += 1
      const csvBody = `${lines.join('\n')}\n`
      const csvPath = `${prefix}/catalog-${Date.now()}-${importBatches}.csv`
      await uploadBytesToGcs(bucket, csvPath, Buffer.from(csvBody, 'utf8'), 'text/csv')
      const opName = await postProductSetImport(projectId, loc, gcsUri(bucket, csvPath))
      await pollVisionOperation(opName)

      const now = new Date().toISOString()
      for (const { id, fp } of ok) {
        const { error: upErr } = await db
          .from('messaging_partner_inventory')
          .update({
            vision_catalog_checksum: fp,
            vision_catalog_synced_at: now,
            updated_at: now,
          })
          .eq('id', id)
          .eq('partner_id', partnerId)
        if (!upErr) imported += 1
      }
    }

    if (toImport.length > 0 && imported === 0 && toRemove.length === 0) {
      return markFail('Could not download any product images for rows pending sync.')
    }

    if (toImport.length > 0 && imported === 0 && removed > 0) {
      return markFail('Could not download any product images for rows pending sync.')
    }

    if (imported > 0 || removed > 0 || (!hasMore && toImport.length === 0 && toRemove.length === 0)) {
      await bumpAiOk()
    }

    return {
      ok: true,
      imported,
      removed,
      importBatches,
      lastScannedId,
      inventoryScanExhausted,
      hasMore,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return markFail(msg)
  }
}

export async function runVisionCatalogPurgeFromTokens(
  db: Db,
  partnerId: string,
  settings: AiSettings,
  tokens: string[]
): Promise<{ ok: true; removed: number; notFound: number } | { error: string }> {
  const projectId = readGcpProjectIdFromEnvOrCredentials()
  if (!projectId) return { error: 'Missing GOOGLE_CLOUD_PROJECT_ID or project_id in credentials.' }

  const loc = settings.vision_location?.trim() || 'us-east1'
  const targetIds = new Set<string>()
  let notFound = 0

  for (const raw of tokens) {
    const tok = raw.trim()
    if (!tok) continue
    if (INVENTORY_UUID_RE.test(tok)) {
      const { data: row, error: oneErr } = await db
        .from('messaging_partner_inventory')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('id', tok)
        .maybeSingle()
      if (oneErr) return { error: oneErr.message }
      if (!row) {
        notFound += 1
        continue
      }
      targetIds.add(row.id)
      continue
    }
    const { data: bySku, error: skuErr } = await db
      .from('messaging_partner_inventory')
      .select('id')
      .eq('partner_id', partnerId)
      .ilike('sku', tok)
    if (skuErr) return { error: skuErr.message }
    if (!bySku?.length) {
      notFound += 1
      continue
    }
    for (const r of bySku) targetIds.add(r.id)
  }

  let removed = 0
  const now = new Date().toISOString()

  for (const invId of targetIds) {
    try {
      await deleteVisionProductForInventory(projectId, loc, invId)
    } catch {
      /* already deleted */
    }
    const { error: upErr } = await db
      .from('messaging_partner_inventory')
      .update({
        vision_catalog_excluded: true,
        vision_catalog_checksum: null,
        vision_catalog_synced_at: null,
        updated_at: now,
      })
      .eq('id', invId)
      .eq('partner_id', partnerId)
    if (upErr) return { error: upErr.message }
    removed += 1
  }

  await db
    .from('messaging_partner_ai_settings')
    .update({
      vision_index_synced_at: now,
      vision_index_error: '',
      updated_at: now,
    })
    .eq('partner_id', partnerId)

  return { ok: true, removed, notFound }
}

export async function visionProductSearchFromImageBuffer(
  imageBuffer: Buffer,
  settings: AiSettings,
  partnerId: string,
  inventoryByVisionId: Map<string, InvRow>,
  usage?: { userId?: string | null },
  options?: { maxResults?: number }
): Promise<{ candidates: VisionSearchCandidate[]; error?: string }> {
  const projectId = readGcpProjectIdFromEnvOrCredentials()
  if (!projectId) return { candidates: [], error: 'Missing GCP project id.' }

  const loc = settings.vision_location?.trim() || 'us-east1'
  const category = (settings.vision_product_category?.trim() || 'general-v1') as VisionProductCategory
  if (!VISION_PRODUCT_CATEGORIES.includes(category)) return { candidates: [], error: 'Invalid category.' }

  const productSetId = visionProductSetIdForPartner(partnerId)
  const productSetResource = `projects/${projectId}/locations/${loc}/productSets/${productSetId}`
  const maxResults = Math.min(25, Math.max(1, Math.floor(options?.maxResults ?? 8)))

  const token = await getGoogleAccessToken([VISION_SCOPE])
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBuffer.toString('base64').replace(/\s/g, '') },
          features: [{ type: 'PRODUCT_SEARCH', maxResults }],
          imageContext: {
            productSearchParams: {
              productSet: productSetResource,
              productCategories: [category],
            },
          },
        },
      ],
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    return { candidates: [], error: `Vision search HTTP ${res.status}: ${t.slice(0, 300)}` }
  }

  const data = (await res.json()) as {
    responses?: Array<{
      error?: { message?: string }
      productSearchResults?: {
        results?: Array<{
          product?: string
          score?: number
          image?: string
        }>
      }
    }>
  }

  void trackApiUsage({
    userId: usage?.userId ?? null,
    model: 'google-cloud-vision',
    feature: 'product_search',
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 1,
  })

  const r0 = data.responses?.[0]
  if (r0?.error?.message) return { candidates: [], error: r0.error.message }

  const results = r0?.productSearchResults?.results ?? []
  const candidates: VisionSearchCandidate[] = []
  const seen = new Set<string>()

  for (const hit of results) {
    const productPath = hit.product ?? ''
    const last = productPath.split('/').pop() ?? ''
    const invId = parseVisionProductIdToInventoryId(last)
    if (!invId) continue
    if (seen.has(invId)) continue
    const row = inventoryByVisionId.get(last)
    if (!row) continue
    seen.add(invId)
    const purl = row.product_url?.trim() ?? ''
    candidates.push({
      inventoryId: row.id,
      name: row.name,
      sku: row.sku,
      image_url: row.image_url ?? '',
      ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
      score: typeof hit.score === 'number' ? hit.score : undefined,
    })
  }

  return { candidates }
}

/** Map product id (inv…) → row — dùng khi search trả về. */
export function buildInventoryMapByVisionProductId(rows: InvRow[]): Map<string, InvRow> {
  const m = new Map<string, InvRow>()
  for (const row of rows) {
    if (row.vision_catalog_excluded) continue
    m.set(visionProductIdForInventory(row.id), row)
  }
  return m
}
