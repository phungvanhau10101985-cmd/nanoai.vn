/**
 * Vertex AI Vision — Image Warehouse (thay thế Vision Product Search).
 * @see https://cloud.google.com/vision-ai/docs/image-warehouse-overview
 */

import { createHash } from 'node:crypto'
import { getGoogleAccessToken, readGcpProjectNumberFromEnvOrApi } from '@/lib/google-sa-token'

const CLOUD_PLATFORM = 'https://www.googleapis.com/auth/cloud-platform'
const VISIONAI_V1 = 'https://visionai.googleapis.com/v1'

export const VISION_WAREHOUSE_LOCATIONS = ['us-central1', 'europe-west4'] as const
export type VisionWarehouseLocation = (typeof VISION_WAREHOUSE_LOCATIONS)[number]

export function normalizeVisionWarehouseLocation(raw: string | null | undefined): VisionWarehouseLocation {
  const t = (raw ?? '').trim()
  if (t === 'europe-west4') return 'europe-west4'
  return 'us-central1'
}

export function warehouseSearchApiBase(location: VisionWarehouseLocation): string {
  if (location === 'europe-west4') return 'https://europe-west4-warehouse-visionai.googleapis.com/v1'
  return 'https://warehouse-visionai.googleapis.com/v1'
}

/**
 * dataSchemas / assets:import / analyze / index PATCH / DELETE asset — phải gọi qua host Warehouse.
 * Dùng visionai.googleapis.com sẽ 501 UNIMPLEMENTED với Media warehouse (Console mới).
 */
export function warehouseManagementApiBase(location: VisionWarehouseLocation): string {
  return warehouseSearchApiBase(location)
}

/**
 * Tên trường dataSchema / annotation trong Image Warehouse.
 * API bắt buộc ^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$ — không dùng underscore.
 */
const VW_PARTNER_SCHEMA_KEY = 'nano-partner-id'
const VW_INVENTORY_SCHEMA_KEY = 'nano-inventory-id'

/** ID asset trong corpus: chữ cái đầu + hex, ≤63 ký tự, khớp regex Warehouse */
export function visionWarehouseAssetId(partnerId: string, inventoryId: string): string {
  const h = createHash('sha256').update(`${partnerId}\n${inventoryId}`).digest('hex')
  return `w${h.slice(0, 40)}`
}

export function readVisionWarehouseConfig():
  | { ok: true; corpusId: string; indexId: string; indexEndpointId: string }
  | { ok: false; error: string } {
  const corpusId = process.env.VISION_WAREHOUSE_CORPUS_ID?.trim()
  const indexId = process.env.VISION_WAREHOUSE_INDEX_ID?.trim()
  const indexEndpointId = process.env.VISION_WAREHOUSE_INDEX_ENDPOINT_ID?.trim()
  if (!corpusId || !indexId || !indexEndpointId) {
    const missing: string[] = []
    if (!corpusId) missing.push('VISION_WAREHOUSE_CORPUS_ID')
    if (!indexId) missing.push('VISION_WAREHOUSE_INDEX_ID')
    if (!indexEndpointId) missing.push('VISION_WAREHOUSE_INDEX_ENDPOINT_ID')
    return {
      ok: false,
      error: `Thiếu biến môi trường: ${missing.join(', ')}. Điền vào .env trên máy chạy Next.js (VPS nếu site production), rồi khởi động lại app. Xem .env.example.`,
    }
  }
  return { ok: true, corpusId, indexId, indexEndpointId }
}

/** Chỉ corpus — đủ cho import catalog (sync) và analyze; không cần index/endpoint. */
export function readVisionWarehouseCorpusConfig():
  | { ok: true; corpusId: string }
  | { ok: false; error: string } {
  const corpusId = process.env.VISION_WAREHOUSE_CORPUS_ID?.trim()
  if (!corpusId) {
    return {
      ok: false,
      error:
        'Thiếu biến môi trường VISION_WAREHOUSE_CORPUS_ID. Điền vào .env và khởi động lại app. Xem .env.example.',
    }
  }
  return { ok: true, corpusId }
}

/** Corpus + index — PATCH rebuild sau analyze (cron); endpoint không dùng ở bước này. */
export function readVisionWarehouseIndexRebuildConfig():
  | { ok: true; corpusId: string; indexId: string }
  | { ok: false; error: string } {
  const corpusId = process.env.VISION_WAREHOUSE_CORPUS_ID?.trim()
  const indexId = process.env.VISION_WAREHOUSE_INDEX_ID?.trim()
  if (!corpusId || !indexId) {
    const missing: string[] = []
    if (!corpusId) missing.push('VISION_WAREHOUSE_CORPUS_ID')
    if (!indexId) missing.push('VISION_WAREHOUSE_INDEX_ID')
    return {
      ok: false,
      error: `Thiếu ${missing.join(', ')} — cần để rebuild index sau khi analyze xong. Thêm vào .env rồi chạy lại đồng bộ catalog (hoặc cron).`,
    }
  }
  return { ok: true, corpusId, indexId }
}

export async function resolveVisionWarehouseProjectNumber(): Promise<string> {
  const n = await readGcpProjectNumberFromEnvOrApi()
  if (!n) throw new Error('Không lấy được GCP project number. Đặt GOOGLE_CLOUD_PROJECT_NUMBER hoặc GOOGLE_CLOUD_PROJECT_ID hợp lệ.')
  return n
}

async function visionAiToken(): Promise<string> {
  return getGoogleAccessToken([CLOUD_PLATFORM])
}

type GcpOperation = {
  name?: string
  done?: boolean
  error?: { message?: string; code?: number }
}

export async function pollVisionAiOperation(
  operationName: string,
  opts?: {
    maxMs?: number
    intervalMs?: number
    warehouseLocation?: VisionWarehouseLocation
    onPending?: () => Promise<void> | void
  }
): Promise<GcpOperation> {
  const maxMs = opts?.maxMs ?? 300_000
  const intervalMs = opts?.intervalMs ?? 5000
  const token = await visionAiToken()
  const apiBase =
    opts?.warehouseLocation != null
      ? warehouseManagementApiBase(opts.warehouseLocation)
      : VISIONAI_V1
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const url = `${apiBase}/${operationName}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Vision AI operation poll failed (${res.status}): ${t.slice(0, 400)}`)
    }
    const op = (await res.json()) as GcpOperation
    if (op.done) {
      if (op.error?.message) throw new Error(op.error.message)
      return op
    }
    await opts?.onPending?.()
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Vision AI operation timeout (${maxMs}ms): ${operationName}`)
}

/** Tạo schema annotation (bỏ qua nếu đã tồn tại). */
export async function ensureVisionWarehouseDataSchemas(
  projectNumber: string,
  location: VisionWarehouseLocation,
  corpusId: string
): Promise<void> {
  const token = await visionAiToken()
  const base = `${warehouseManagementApiBase(location)}/projects/${encodeURIComponent(projectNumber)}/locations/${encodeURIComponent(location)}/corpora/${encodeURIComponent(corpusId)}/dataSchemas`
  const schemas: Array<{ key: string; type: string; search: string }> = [
    { key: VW_PARTNER_SCHEMA_KEY, type: 'STRING', search: 'EXACT_SEARCH' },
    { key: VW_INVENTORY_SCHEMA_KEY, type: 'STRING', search: 'EXACT_SEARCH' },
    { key: 'title', type: 'STRING', search: 'NO_SEARCH' },
  ]
  for (const s of schemas) {
    const res = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: s.key,
        schemaDetails: {
          type: s.type,
          granularity: 'GRANULARITY_ASSET_LEVEL',
          searchStrategy: { searchStrategyType: s.search },
        },
      }),
    })
    if (res.ok || res.status === 409) continue
    const t = await res.text()
    if (res.status === 400 && /already exists|duplicate/i.test(t)) continue
    throw new Error(`Vision Warehouse dataSchema ${s.key} (${res.status}): ${t.slice(0, 400)}`)
  }
}

export async function importVisionWarehouseAssetsJsonl(params: {
  projectNumber: string
  location: VisionWarehouseLocation
  corpusId: string
  assetsGcsUri: string
}): Promise<string> {
  const url = `${warehouseManagementApiBase(params.location)}/projects/${encodeURIComponent(params.projectNumber)}/locations/${encodeURIComponent(params.location)}/corpora/${encodeURIComponent(params.corpusId)}/assets:import`
  /**
   * Google chỉ cho 1 ImportAssets / corpus.
   * Không retry/backoff quá lâu trong cùng request vì sẽ giữ lock nội bộ rất lâu và làm mọi worker khác "đứng chờ".
   * Trả lỗi nhanh để cron lượt sau thử lại.
   */
  const maxAttempts = 2
  const requestTimeoutMs = 45_000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await visionAiToken()
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), requestTimeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetsGcsUri: params.assetsGcsUri }),
        signal: ctrl.signal,
      })
    } catch (e) {
      clearTimeout(timer)
      const timeoutLike =
        (e instanceof Error && /aborted|timeout/i.test(e.message)) ||
        String(e).toLowerCase().includes('aborted')
      if (timeoutLike) {
        if (attempt >= maxAttempts) {
          throw new Error(`Vision Warehouse assets:import request timeout (${requestTimeoutMs}ms)`)
        }
        const backoffMs = 4_000
        await new Promise((r) => setTimeout(r, backoffMs))
        continue
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
    if (res.status === 429) {
      const t = await res.text()
      if (attempt >= maxAttempts) {
        throw new Error(`Vision Warehouse assets:import (${res.status}): ${t.slice(0, 600)}`)
      }
      const backoffMs = 4_000
      await new Promise((r) => setTimeout(r, backoffMs))
      continue
    }
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`Vision Warehouse assets:import (${res.status}): ${t.slice(0, 600)}`)
    }
    const data = (await res.json()) as { name?: string }
    if (!data.name) throw new Error('Vision Warehouse import: missing operation name')
    return data.name
  }
  throw new Error('Vision Warehouse assets:import: retry exhausted')
}

export async function analyzeVisionWarehouseCorpus(
  projectNumber: string,
  location: VisionWarehouseLocation,
  corpusId: string
): Promise<string> {
  const token = await visionAiToken()
  const name = `projects/${encodeURIComponent(projectNumber)}/locations/${encodeURIComponent(location)}/corpora/${encodeURIComponent(corpusId)}`
  const url = `${warehouseManagementApiBase(location)}/${name}:analyze`
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vision Warehouse analyze (${res.status}): ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as { name?: string }
  if (!data.name) throw new Error('Vision Warehouse analyze: missing operation name')
  return data.name
}

export async function rebuildVisionWarehouseIndex(
  projectNumber: string,
  location: VisionWarehouseLocation,
  corpusId: string,
  indexId: string
): Promise<string> {
  const token = await visionAiToken()
  const indexResource = `projects/${encodeURIComponent(projectNumber)}/locations/${encodeURIComponent(location)}/corpora/${encodeURIComponent(corpusId)}/indexes/${encodeURIComponent(indexId)}`
  const url = `${warehouseManagementApiBase(location)}/${indexResource}?updateMask=%2A`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vision Warehouse index PATCH (${res.status}): ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as { name?: string }
  if (!data.name) throw new Error('Vision Warehouse index rebuild: missing operation name')
  return data.name
}

export async function deleteVisionWarehouseAsset(params: {
  projectNumber: string
  location: VisionWarehouseLocation
  corpusId: string
  assetId: string
}): Promise<void> {
  const token = await visionAiToken()
  const name = `projects/${encodeURIComponent(params.projectNumber)}/locations/${encodeURIComponent(params.location)}/corpora/${encodeURIComponent(params.corpusId)}/assets/${encodeURIComponent(params.assetId)}`
  const url = `${warehouseManagementApiBase(params.location)}/${name}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404 || res.status === 204) return
  if (!res.ok) {
    const t = await res.text()
    if (res.status === 400 && /not found|does not exist/i.test(t)) return
    throw new Error(`Vision Warehouse asset DELETE (${res.status}): ${t.slice(0, 400)}`)
  }
  let data: { name?: string } = {}
  try {
    data = (await res.json()) as { name?: string }
  } catch {
    return
  }
  if (data.name) {
    try {
      await pollVisionAiOperation(data.name, { maxMs: 120_000, warehouseLocation: params.location })
    } catch {
      /* best effort */
    }
  }
}

/**
 * Tìm ảnh tương tự trong index; lọc theo trường partner (kebab-case, cùng dataSchema).
 * Body JSON theo ví dụ REST Google (snake_case ở key ngoài cùng).
 */
export async function searchVisionWarehouseByImage(params: {
  projectNumber: string
  location: VisionWarehouseLocation
  indexEndpointId: string
  partnerId: string
  imageBase64: string
  maxResults: number
}): Promise<Array<{ assetId: string; relevance: number }>> {
  const token = await visionAiToken()
  const base = warehouseSearchApiBase(params.location)
  const url = `${base}/projects/${encodeURIComponent(params.projectNumber)}/locations/${encodeURIComponent(params.location)}/indexEndpoints/${encodeURIComponent(params.indexEndpointId)}:searchIndexEndpoint`
  const body = {
    image_query: {
      input_image: params.imageBase64.replace(/\s/g, ''),
    },
    criteria: [
      {
        field: VW_PARTNER_SCHEMA_KEY,
        text_array: {
          txt_values: [params.partnerId],
        },
      },
    ],
    page_size: params.maxResults,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Vision Warehouse search (${res.status}): ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    searchResultItems?: Array<{ asset?: string; relevance?: number | string }>
  }
  const items = data.searchResultItems ?? []
  const out: Array<{ assetId: string; relevance: number }> = []
  for (const it of items) {
    const assetPath = it.asset ?? ''
    const last = assetPath.split('/').pop() ?? ''
    if (!last) continue
    const rel = typeof it.relevance === 'number' ? it.relevance : parseFloat(String(it.relevance ?? '0'))
    out.push({ assetId: last, relevance: Number.isFinite(rel) ? rel : 0 })
  }
  return out
}

/** Một dòng JSONL cho ImportAssets (InputImageAsset). */
export function visionWarehouseJsonlLine(params: {
  gcsUri: string
  assetId: string
  partnerId: string
  inventoryId: string
  title: string
}): string {
  const title = params.title.trim().slice(0, 500) || 'product'
  const line = {
    gcsUri: params.gcsUri,
    assetId: params.assetId,
    annotations: [
      { key: VW_PARTNER_SCHEMA_KEY, value: { strValue: params.partnerId } },
      { key: VW_INVENTORY_SCHEMA_KEY, value: { strValue: params.inventoryId } },
      { key: 'title', value: { strValue: title } },
    ],
  }
  return `${JSON.stringify(line)}\n`
}
