/**
 * Vertex AI Vision — Image Warehouse: đồng bộ ảnh kho (GCS + import JSONL) và tìm theo ảnh.
 * (Thay thế Vision Product Search — đang bảo trì.)
 */

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { getGoogleAccessToken, readGcpProjectIdFromEnvOrCredentials } from '@/lib/google-sa-token'
import { fetchRemoteImageForCatalog } from '@/lib/fetch-image-1688'
import {
  VISION_INCREMENTAL_MAX_SCAN_PAGES,
  VISION_INCREMENTAL_SCAN_PAGE,
  VISION_PRODUCT_CATEGORIES,
  VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE,
  VISION_WAREHOUSE_REINDEX_PENDING_CODE,
  isVisionWarehouseCorpusUnsupportedTypeApiMessage,
  isVisionCatalogImageUrlSyncable,
  normalizeVisionCatalogImageUrl,
  normalizeVisionProductSearchLocation,
  type VisionProductCategory,
} from '@/lib/messaging/partner-vision-constants'
import {
  resolveVisionIncrementalBatchSize,
  resolveVisionIncrementalMaxDirtyPerRequest,
  resolveVisionIncrementalMaxImportsPerRequest,
  resolveVisionWarehouseAssetsImportPollMaxMs,
  resolveVisionWarehousePostImportCooldownMs,
} from '@/lib/messaging/partner-vision-server-config'
import {
  deleteVisionWarehouseAsset,
  ensureVisionWarehouseDataSchemas,
  importVisionWarehouseAssetsJsonl,
  pollVisionAiOperation,
  readVisionWarehouseCorpusConfig,
  readVisionWarehouseConfig,
  resolveVisionWarehouseProjectNumber,
  searchVisionWarehouseByImage,
  visionWarehouseJsonlLine,
  visionWarehouseAssetId,
  type VisionWarehouseLocation,
} from '@/lib/messaging/partner-vision-warehouse'
import { acquireVisionWarehouseImportLock, releaseVisionWarehouseImportLock } from '@/lib/messaging/partner-vision-import-lock'
import { markVisionWarehousePendingWork } from '@/lib/messaging/partner-vision-warehouse-runner'
import { trackApiUsage } from '@/lib/track-ai-usage'

type Db = SupabaseClient<Database>
type AiSettings = Database['public']['Tables']['messaging_partner_ai_settings']['Row']
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export type { VisionProductCategory }
export { VISION_PRODUCT_CATEGORIES }

export type VisionSearchCandidate = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  score?: number
}

export type GuestMessageVisionPayload = {
  vision_candidates?: VisionSearchCandidate[]
  vision_pick_required?: boolean
  vision_search_error?: string
  /** true khi đã chạy tìm theo ảnh nhưng không có ứng viên trong kho */
  vision_catalog_no_hits?: boolean
  vision_selected_inventory_id?: string
  vision_selected_product_label?: string
}

function gcsUri(bucket: string, object: string): string {
  return `gs://${bucket.replace(/^\/+|\/+$/g, '')}/${object.replace(/^\/+/, '')}`
}

async function uploadBytesToGcs(bucket: string, objectName: string, body: Buffer, contentType: string): Promise<void> {
  const token = await getGoogleAccessToken([CLOUD_PLATFORM_SCOPE])
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

async function fetchImageBytesFromUrl(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  // Ảnh nguồn chậm thường làm nghẽn cả lượt sync; timeout ngắn để bỏ qua ảnh lỗi và tiếp tục backlog.
  return fetchRemoteImageForCatalog(url, { timeoutMs: 12_000 })
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
  const imgKey = normalizeVisionCatalogImageUrl(row.image_url)
  return createHash('sha256')
    .update(`${imgKey}\n${(row.name ?? '').trim()}`, 'utf8')
    .digest('hex')
}

function isVisionCatalogRowDirty(row: InvRow): boolean {
  if (row.vision_catalog_excluded) return false
  const valid = isVisionCatalogImageUrlSyncable(row.image_url)
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

async function warehouseDeleteForInventory(
  projectNumber: string,
  loc: VisionWarehouseLocation,
  corpusId: string,
  partnerId: string,
  inventoryId: string
): Promise<void> {
  const assetId = visionWarehouseAssetId(partnerId, inventoryId)
  await deleteVisionWarehouseAsset({ projectNumber, location: loc, corpusId, assetId })
}

export async function tryDeleteVisionProductForInventoryItem(db: Db, partnerId: string, inventoryId: string): Promise<void> {
  const cfg = readVisionWarehouseCorpusConfig()
  if (!cfg.ok) return
  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch {
    return
  }
  const { data: settings } = await db
    .from('messaging_partner_ai_settings')
    .select('vision_location')
    .eq('partner_id', partnerId)
    .maybeSingle()
  const loc = normalizeVisionProductSearchLocation(settings?.vision_location) as VisionWarehouseLocation
  try {
    await warehouseDeleteForInventory(projectNumber, loc, cfg.corpusId, partnerId, inventoryId)
    await markVisionWarehousePendingWork(db, loc)
  } catch {
    /* đã xóa hoặc chưa index */
  }
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

  const whCfg = readVisionWarehouseCorpusConfig()
  if (!whCfg.ok) return markFail(whCfg.error)

  const projectId = readGcpProjectIdFromEnvOrCredentials()
  if (!projectId) return markFail('Missing GOOGLE_CLOUD_PROJECT_ID or project_id in credentials.')

  const bucket = resolveVisionCatalogBucket(settings)
  if (!bucket) return markFail('Configure GCS_VISION_CATALOG_BUCKET or shop bucket override.')

  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch (e) {
    return markFail(e instanceof Error ? e.message : String(e))
  }

  const loc = normalizeVisionProductSearchLocation(settings.vision_location) as VisionWarehouseLocation
  const categoryRaw = (settings.vision_product_category?.trim() || 'general-v1') as VisionProductCategory
  if (!VISION_PRODUCT_CATEGORIES.includes(categoryRaw)) {
    return markFail('Invalid vision product category.')
  }

  const { corpusId } = whCfg

  const prefix = `vision-warehouse/${partnerId.replace(/[^a-z0-9-]/gi, '')}`
  const resume = opts?.resumeAfterId?.trim() || null

  const batchSize = resolveVisionIncrementalBatchSize()
  const maxImportsThisRun = resolveVisionIncrementalMaxImportsPerRequest()
  const maxDirtyPerRequest = resolveVisionIncrementalMaxDirtyPerRequest()
  const importPollMaxMs = resolveVisionWarehouseAssetsImportPollMaxMs()
  const postImportCooldownMs = resolveVisionWarehousePostImportCooldownMs()

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
      const url = normalizeVisionCatalogImageUrl(row.image_url)
      const valid = !!(url && /^https?:\/\//i.test(url))
      if (!valid) {
        if (row.vision_catalog_checksum) toRemove.push(row)
      } else {
        toImport.push(row)
      }
      if (toImport.length + toRemove.length >= maxDirtyPerRequest) {
        break scan
      }
    }
    if (page.length < VISION_INCREMENTAL_SCAN_PAGE) {
      inventoryScanExhausted = true
      break scan
    }
  }

  const lastScannedId = scanCursor
  const hitDirtyCap = toImport.length + toRemove.length >= maxDirtyPerRequest
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

  const flagWarehousePendingForPartner = async () => {
    const now = new Date().toISOString()
    await markVisionWarehousePendingWork(db, loc)
    await db
      .from('messaging_partner_ai_settings')
      .update({
        vision_index_ready: false,
        vision_index_error: VISION_WAREHOUSE_REINDEX_PENDING_CODE,
        vision_index_synced_at: now,
        updated_at: now,
      })
      .eq('partner_id', partnerId)
  }

  try {
    let removed = 0
    let warehouseTouched = false

    for (const row of toRemove) {
      try {
        await warehouseDeleteForInventory(projectNumber, loc, corpusId, partnerId, row.id)
        warehouseTouched = true
      } catch {
        /* ignore */
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
    if (removed > 0) warehouseTouched = true

    let imported = 0
    let importBatches = 0
    let schemasReady = false

    const importSlices: InvRow[][] = []
    for (let i = 0; i < toImport.length; i += batchSize) {
      importSlices.push(toImport.slice(i, i + batchSize))
    }
    const slicesToRun = importSlices.slice(0, maxImportsThisRun)

    if (toImport.length > 0) {
      await acquireVisionWarehouseImportLock(db, { maxWaitMs: 20_000 })
    }
    try {
      for (const slice of slicesToRun) {
        const jsonlLines: string[] = []
        const ok: { id: string; fp: string }[] = []

        for (const row of slice) {
          const url = normalizeVisionCatalogImageUrl(row.image_url)
          const got = await fetchImageBytesFromUrl(url)
          if (!got) continue
          const ext = extFromContentType(got.contentType)
          const assetId = visionWarehouseAssetId(partnerId, row.id)
          const objectPath = `${prefix}/assets/${assetId}.${ext}`
          await uploadBytesToGcs(bucket, objectPath, got.buf, got.contentType)
          const gs = gcsUri(bucket, objectPath)
          const title = row.name?.trim() || assetId
          jsonlLines.push(
            visionWarehouseJsonlLine({
              gcsUri: gs,
              assetId,
              partnerId,
              inventoryId: row.id,
              title,
            })
          )
          ok.push({ id: row.id, fp: catalogFingerprintForVisionRow(row) })
        }

        if (jsonlLines.length === 0) continue

        if (!schemasReady) {
          await ensureVisionWarehouseDataSchemas(projectNumber, loc, corpusId)
          schemasReady = true
        }

        importBatches += 1
        const jsonlPath = `${prefix}/batch-${Date.now()}-${importBatches}.jsonl`
        await uploadBytesToGcs(bucket, jsonlPath, Buffer.from(jsonlLines.join(''), 'utf8'), 'application/x-ndjson')

        const importOp = await importVisionWarehouseAssetsJsonl({
          projectNumber,
          location: loc,
          corpusId,
          assetsGcsUri: gcsUri(bucket, jsonlPath),
        })
        await pollVisionAiOperation(importOp, {
          maxMs: importPollMaxMs,
          warehouseLocation: loc,
        })
        warehouseTouched = true

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

        if (postImportCooldownMs > 0) {
          await new Promise((r) => setTimeout(r, postImportCooldownMs))
        }
      }
    } finally {
      if (toImport.length > 0) {
        await releaseVisionWarehouseImportLock(db)
      }
    }

    if (toImport.length > 0 && imported === 0 && toRemove.length === 0) {
      return markFail('Could not download any product images for rows pending sync.')
    }

    if (toImport.length > 0 && imported === 0 && removed > 0) {
      return markFail('Could not download any product images for rows pending sync.')
    }

    if (warehouseTouched) {
      await flagWarehousePendingForPartner()
    } else if (imported > 0 || removed > 0 || (!hasMore && toImport.length === 0 && toRemove.length === 0)) {
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
    if (isVisionWarehouseCorpusUnsupportedTypeApiMessage(msg)) {
      return markFail(VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE)
    }
    /** Khóa import đang bận (worker khác đang giữ hoặc vừa treo): để cron thử lại, không markFail cứng. */
    if (
      /Vision Warehouse: corpus đang bị giữ bởi lượt import khác/i.test(msg) ||
      /Vision import lock/i.test(msg)
    ) {
      return { error: msg }
    }
    /** Timeout poll `assets:import` — không markFail (tránh vision_index_error đỏ); cron/ client có thể thử lại sau. */
    if (/Vision AI operation timeout/i.test(msg)) {
      return { error: msg }
    }
    return markFail(msg)
  }
}

export async function runVisionCatalogPurgeFromTokens(
  db: Db,
  partnerId: string,
  settings: AiSettings,
  tokens: string[]
): Promise<{ ok: true; removed: number; notFound: number } | { error: string }> {
  const whCfg = readVisionWarehouseCorpusConfig()
  if (!whCfg.ok) return { error: whCfg.error }

  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  const loc = normalizeVisionProductSearchLocation(settings.vision_location) as VisionWarehouseLocation
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
  let warehouseTouched = false

  for (const invId of targetIds) {
    try {
      await warehouseDeleteForInventory(projectNumber, loc, whCfg.corpusId, partnerId, invId)
      warehouseTouched = true
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

  if (warehouseTouched) await markVisionWarehousePendingWork(db, loc)

  await db
    .from('messaging_partner_ai_settings')
    .update({
      vision_index_synced_at: now,
      vision_index_error: warehouseTouched ? VISION_WAREHOUSE_REINDEX_PENDING_CODE : '',
      vision_index_ready: !warehouseTouched,
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
  const whCfg = readVisionWarehouseConfig()
  if (!whCfg.ok) return { candidates: [], error: whCfg.error }

  let projectNumber: string
  try {
    projectNumber = await resolveVisionWarehouseProjectNumber()
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) }
  }

  const loc = normalizeVisionProductSearchLocation(settings.vision_location) as VisionWarehouseLocation
  const category = (settings.vision_product_category?.trim() || 'general-v1') as VisionProductCategory
  if (!VISION_PRODUCT_CATEGORIES.includes(category)) return { candidates: [], error: 'Invalid category.' }

  const maxResults = Math.min(25, Math.max(1, Math.floor(options?.maxResults ?? 8)))

  try {
    const hits = await searchVisionWarehouseByImage({
      projectNumber,
      location: loc,
      indexEndpointId: whCfg.indexEndpointId,
      partnerId,
      imageBase64: imageBuffer.toString('base64'),
      maxResults,
    })

    void trackApiUsage({
      userId: usage?.userId ?? null,
      model: 'google-vision-warehouse',
      feature: 'image_similarity_search',
      promptTokenCount: 0,
      candidatesTokenCount: hits.length,
      totalTokenCount: 1,
    })

    const candidates: VisionSearchCandidate[] = []
    const seen = new Set<string>()

    for (const hit of hits) {
      const row = inventoryByVisionId.get(hit.assetId)
      if (!row) continue
      if (seen.has(row.id)) continue
      seen.add(row.id)
      const purl = row.product_url?.trim() ?? ''
      candidates.push({
        inventoryId: row.id,
        name: row.name,
        sku: row.sku,
        image_url: row.image_url ?? '',
        ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
        score: hit.relevance,
      })
    }

    return { candidates }
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export function buildInventoryMapByVisionProductId(rows: InvRow[], partnerId: string): Map<string, InvRow> {
  const m = new Map<string, InvRow>()
  for (const row of rows) {
    if (row.vision_catalog_excluded) continue
    m.set(visionWarehouseAssetId(partnerId, row.id), row)
  }
  return m
}

export { visionWarehouseAssetId }
