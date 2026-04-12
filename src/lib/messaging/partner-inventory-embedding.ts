import {
  fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg,
  fetchPartnerInventorySliceByUpdatedAtAscFromPg,
  updatePartnerInventoryEmbeddingFieldsFromPg,
  type PartnerInventoryEmbeddingUpdatePatch,
} from '@/lib/db/messaging-partner-inventory-pg'
import { insertMessagingPartnerImageEmbedUsageFromPg } from '@/lib/db/messaging-partner-image-embed-usage-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchRemoteImageForCatalog, sniffImageContentType } from '@/lib/fetch-image-1688'
import type { Database } from '@/types/database.types'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
const DB_VECTOR_DIMS = 768

const GEMINI_EMBED_MODEL = process.env.GEMINI_IMAGE_EMBED_MODEL?.trim() || 'gemini-embedding-2-preview'
/** Khi API không trả usageMetadata (hiếm), ước token billable cho một ảnh embed. */
const GEMINI_IMAGE_EMBED_FALLBACK_TOKENS = Math.max(
  1,
  parseInt(process.env.GEMINI_IMAGE_EMBED_FALLBACK_TOKENS || '560', 10) || 560
)

export type GeminiImageEmbedResult = {
  values: number[]
  promptTokens: number
  totalTokens: number
}
const GEMINI_EMBED_DIMS = Math.max(
  128,
  Math.min(3072, parseInt(process.env.GEMINI_IMAGE_EMBED_DIMS || '768', 10) || 768)
)
const MAX_PARALLEL = Math.max(
  1,
  Math.min(8, parseInt(process.env.GEMINI_IMAGE_SEARCH_PARALLEL || '4', 10) || 4)
)
const SYNC_LIMIT = Math.max(
  20,
  Math.min(5000, parseInt(process.env.GEMINI_IMAGE_EMBED_SYNC_LIMIT || '1200', 10) || 1200)
)
const SCAN_PAGE_SIZE = Math.max(
  100,
  Math.min(5000, parseInt(process.env.GEMINI_IMAGE_EMBED_SCAN_PAGE_SIZE || '1000', 10) || 1000)
)
const SCAN_MAX_ROWS = Math.max(
  1000,
  Math.min(200000, parseInt(process.env.GEMINI_IMAGE_EMBED_SCAN_MAX_ROWS || '30000', 10) || 30000)
)

function normalizeImageUrl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (t.startsWith('//')) return `https:${t}`
  return t
}

function rowAsEmbeddingComparable(
  row: Pick<InvRow, 'id' | 'partner_id' | 'name' | 'image_url' | 'is_active'> &
    Partial<
      Pick<
        InvRow,
        | 'image_embedding_json'
        | 'image_embedding_fingerprint'
        | 'image_embedding_model'
        | 'image_embedding_dims'
        | 'image_embedding_vec'
      >
    >
): InvRow {
  return {
    id: row.id,
    partner_id: row.partner_id,
    sort_order: 0,
    sku: null,
    name: row.name ?? '',
    description: '',
    stock_note: '',
    stock_qty: 0,
    price_hint: '',
    image_url: row.image_url ?? '',
    product_url: '',
    product_video_url: '',
    consult_note: '',
    material_note: '',
    material_detail_image_url: '',
    real_use_image_url: '',
    real_use_image_url_2: '',
    is_active: Boolean(row.is_active),
    image_embedding_json: (row.image_embedding_json as number[] | null | undefined) ?? null,
    image_embedding_fingerprint: row.image_embedding_fingerprint ?? null,
    image_embedding_model: row.image_embedding_model ?? null,
    image_embedding_dims: row.image_embedding_dims ?? null,
    image_embedding_vec: row.image_embedding_vec ?? null,
    image_embedding_updated_at: null,
    image_embedding_error: null,
    vision_catalog_checksum: null,
    vision_catalog_synced_at: null,
    vision_catalog_excluded: false,
    created_at: '',
    updated_at: '',
  }
}

function isHttpImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function detectImageMimeType(buf: Buffer): string {
  return sniffImageContentType(buf) || 'image/jpeg'
}

function rowFingerprint(row: Pick<InvRow, 'image_url' | 'name'>): string {
  return `${normalizeImageUrl(row.image_url)}\n${(row.name ?? '').trim()}`
}

function vectorsEqual(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return false
  }
  return true
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => (Number.isFinite(v) ? Number(v) : 0)).join(',')}]`
}

type EmbeddingComparableRow = Pick<
  InvRow,
  | 'id'
  | 'partner_id'
  | 'name'
  | 'image_url'
  | 'is_active'
  | 'image_embedding_json'
  | 'image_embedding_fingerprint'
  | 'image_embedding_model'
  | 'image_embedding_dims'
  | 'image_embedding_vec'
>

function needsEmbeddingSync(row: EmbeddingComparableRow, force = false): boolean {
  const imageUrl = normalizeImageUrl(row.image_url)
  if (!row.is_active) return false
  if (!isHttpImageUrl(imageUrl)) return false
  if (force) return true
  const nextFp = rowFingerprint(row)
  const hasEmbedding = Array.isArray(row.image_embedding_json)
  const hasVectorColumn = typeof row.image_embedding_vec === 'string' && row.image_embedding_vec.trim().length > 0
  const sameFp = row.image_embedding_fingerprint === nextFp
  const sameModel = (row.image_embedding_model ?? '') === GEMINI_EMBED_MODEL
  const sameDims = (row.image_embedding_dims ?? 0) === GEMINI_EMBED_DIMS
  return !(hasEmbedding && hasVectorColumn && sameFp && sameModel && sameDims)
}

export async function embedImageBufferWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<GeminiImageEmbedResult> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY for Gemini image embeddings.')

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_EMBED_MODEL
  )}:embedContent?key=${encodeURIComponent(apiKey)}`

  const body = {
    model: `models/${GEMINI_EMBED_MODEL}`,
    content: {
      parts: [
        {
          inline_data: {
            mime_type: mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ],
    },
    outputDimensionality: GEMINI_EMBED_DIMS,
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Gemini embed failed (${res.status}): ${text.slice(0, 300)}`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('Gemini embed response is not valid JSON.')
  }
  const p = payload as
    | {
        embedding?: { values?: number[] }
        embeddings?: Array<{ values?: number[] }>
        usageMetadata?: { promptTokenCount?: number; totalTokenCount?: number }
      }
    | undefined
  const values = p?.embedding?.values ?? p?.embeddings?.[0]?.values
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Gemini embed response is missing embedding values.')
  }
  const um = p?.usageMetadata
  const promptTok = Math.max(
    1,
    um?.promptTokenCount ?? um?.totalTokenCount ?? GEMINI_IMAGE_EMBED_FALLBACK_TOKENS
  )
  const totalTok = Math.max(1, um?.totalTokenCount ?? promptTok)
  return {
    values: values.map((v) => Number(v) || 0),
    promptTokens: promptTok,
    totalTokens: totalTok,
  }
}

async function embedImageUrlWithGemini(imageUrl: string): Promise<GeminiImageEmbedResult | null> {
  const img = await fetchRemoteImageForCatalog(imageUrl, { timeoutMs: 12_000 })
  if (!img) return null
  return embedImageBufferWithGemini(img.buf, img.contentType || detectImageMimeType(img.buf))
}

async function persistInventoryEmbeddingPatch(
  partnerId: string,
  rowId: string,
  patch: PartnerInventoryEmbeddingUpdatePatch
): Promise<boolean> {
  if (!isPgConfigured()) return false
  return updatePartnerInventoryEmbeddingFieldsFromPg(partnerId, rowId, patch)
}

export async function syncPartnerInventoryEmbeddings(
  partnerId: string,
  options?: { inventoryIds?: string[]; force?: boolean; limit?: number }
): Promise<{ ok: true; synced: number; failed: number; skipped: number } | { ok: false; error: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'Postgres (DATABASE_URL) is not configured.' }
  }

  const cap = Math.max(1, Math.min(5000, options?.limit ?? SYNC_LIMIT))
  const idList = (options?.inventoryIds ?? []).map((x) => x.trim()).filter(Boolean)
  const rows: InvRow[] = []

  if (idList.length > 0) {
    const pgRows = await fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg(partnerId, idList)
    if (pgRows === null) {
      return { ok: false, error: 'Could not load inventory rows for embedding sync.' }
    }
    rows.push(...pgRows.map((r) => rowAsEmbeddingComparable(r)))
  } else {
    let scanned = 0
    let from = 0
    while (scanned < SCAN_MAX_ROWS && rows.length < cap) {
      const page = await fetchPartnerInventorySliceByUpdatedAtAscFromPg(partnerId, SCAN_PAGE_SIZE, from)
      if (page === null) {
        return { ok: false, error: 'Could not scan inventory for embedding sync.' }
      }
      const chunk = page.map((r) => rowAsEmbeddingComparable(r))
      if (chunk.length === 0) break
      scanned += chunk.length
      for (const row of chunk) {
        if (needsEmbeddingSync(row, Boolean(options?.force))) rows.push(row)
        if (rows.length >= cap) break
      }
      if (chunk.length < SCAN_PAGE_SIZE) break
      from += SCAN_PAGE_SIZE
    }
  }

  const candidates = rows.filter((row) => needsEmbeddingSync(row, Boolean(options?.force)))
  if (candidates.length === 0) return { ok: true, synced: 0, failed: 0, skipped: rows.length }

  let cursor = 0
  let synced = 0
  let failed = 0

  const workers = Array.from({ length: Math.min(MAX_PARALLEL, candidates.length) }, async () => {
    while (true) {
      const i = cursor
      cursor += 1
      if (i >= candidates.length) break
      const row = candidates[i]
      const imageUrl = normalizeImageUrl(row.image_url)
      const fp = rowFingerprint(row)
      const nowIso = new Date().toISOString()
      try {
        const embedOut = await embedImageUrlWithGemini(imageUrl)
        const vec = embedOut?.values
        if (!vec || vec.length === 0) {
          failed += 1
          await persistInventoryEmbeddingPatch(partnerId, row.id, {
            image_embedding_json: null,
            image_embedding_fingerprint: fp,
            image_embedding_model: GEMINI_EMBED_MODEL,
            image_embedding_dims: GEMINI_EMBED_DIMS,
            image_embedding_vec: null,
            image_embedding_updated_at: nowIso,
            image_embedding_error: 'FETCH_OR_EMBED_FAILED',
          })
          continue
        }
        void insertMessagingPartnerImageEmbedUsageFromPg({
          partnerId,
          source: 'inventory_sync',
          model: GEMINI_EMBED_MODEL,
          promptTokens: embedOut.promptTokens,
          totalTokens: embedOut.totalTokens,
          inventoryId: row.id,
        })
        if (
          Array.isArray(row.image_embedding_json) &&
          vectorsEqual(row.image_embedding_json as number[], vec) &&
          row.image_embedding_fingerprint === fp &&
          row.image_embedding_model === GEMINI_EMBED_MODEL &&
          row.image_embedding_dims === vec.length &&
          typeof row.image_embedding_vec === 'string' &&
          row.image_embedding_vec.trim().length > 0
        ) {
          synced += 1
          continue
        }
        const upOk = await persistInventoryEmbeddingPatch(partnerId, row.id, {
          image_embedding_json: vec,
          image_embedding_fingerprint: fp,
          image_embedding_model: GEMINI_EMBED_MODEL,
          image_embedding_dims: vec.length,
          image_embedding_vec: vec.length === DB_VECTOR_DIMS ? toPgVectorLiteral(vec) : null,
          image_embedding_updated_at: nowIso,
          image_embedding_error:
            vec.length === DB_VECTOR_DIMS ? '' : `VECTOR_DIM_MISMATCH:${vec.length}!=${DB_VECTOR_DIMS}`,
        })
        if (!upOk) {
          failed += 1
          continue
        }
        synced += 1
      } catch (e) {
        failed += 1
        const msg = e instanceof Error ? e.message : String(e)
        await persistInventoryEmbeddingPatch(partnerId, row.id, {
          image_embedding_json: null,
          image_embedding_fingerprint: fp,
          image_embedding_model: GEMINI_EMBED_MODEL,
          image_embedding_dims: GEMINI_EMBED_DIMS,
          image_embedding_vec: null,
          image_embedding_updated_at: nowIso,
          image_embedding_error: msg.slice(0, 300),
        })
      }
    }
  })
  await Promise.all(workers)

  return {
    ok: true,
    synced,
    failed,
    skipped: Math.max(0, rows.length - candidates.length),
  }
}
