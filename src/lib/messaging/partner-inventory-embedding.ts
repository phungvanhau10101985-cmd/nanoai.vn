import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRemoteImageForCatalog, sniffImageContentType } from '@/lib/fetch-image-1688'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
const DB_VECTOR_DIMS = 768

const GEMINI_EMBED_MODEL = process.env.GEMINI_IMAGE_EMBED_MODEL?.trim() || 'gemini-embedding-2-preview'
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
    price_hint: '',
    image_url: row.image_url ?? '',
    product_url: '',
    consult_note: '',
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

export async function embedImageBufferWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<number[]> {
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
    | { embedding?: { values?: number[] }; embeddings?: Array<{ values?: number[] }> }
    | undefined
  const values = p?.embedding?.values ?? p?.embeddings?.[0]?.values
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Gemini embed response is missing embedding values.')
  }
  return values.map((v) => Number(v) || 0)
}

async function embedImageUrlWithGemini(imageUrl: string): Promise<number[] | null> {
  const img = await fetchRemoteImageForCatalog(imageUrl, { timeoutMs: 12_000 })
  if (!img) return null
  return embedImageBufferWithGemini(img.buf, img.contentType || detectImageMimeType(img.buf))
}

export async function syncPartnerInventoryEmbeddings(
  db: Db,
  partnerId: string,
  options?: { inventoryIds?: string[]; force?: boolean; limit?: number }
): Promise<{ ok: true; synced: number; failed: number; skipped: number } | { ok: false; error: string }> {
  const cap = Math.max(1, Math.min(5000, options?.limit ?? SYNC_LIMIT))
  const idList = (options?.inventoryIds ?? []).map((x) => x.trim()).filter(Boolean)

  let query = db
    .from('messaging_partner_inventory')
    .select(
      'id, partner_id, name, image_url, is_active, image_embedding_json, image_embedding_fingerprint, image_embedding_model, image_embedding_dims, image_embedding_vec'
    )
    .eq('partner_id', partnerId)
    .order('updated_at', { ascending: false })
    .limit(Math.max(cap, idList.length || 1))

  if (idList.length > 0) query = query.in('id', idList)

  const { data, error } = await query
  if (error) return { ok: false, error: error.message }

  const rows = (data ?? []).map((r) =>
    rowAsEmbeddingComparable(
      r as Pick<InvRow, 'id' | 'partner_id' | 'name' | 'image_url' | 'is_active'> &
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
    )
  )
  const candidates = rows.filter((row) => {
    const imageUrl = normalizeImageUrl(row.image_url)
    if (!row.is_active) return false
    if (!isHttpImageUrl(imageUrl)) return false
    if (options?.force) return true
    const nextFp = rowFingerprint(row)
    const hasEmbedding = Array.isArray(row.image_embedding_json)
    const hasVectorColumn = typeof row.image_embedding_vec === 'string' && row.image_embedding_vec.trim().length > 0
    const sameFp = row.image_embedding_fingerprint === nextFp
    const sameModel = (row.image_embedding_model ?? '') === GEMINI_EMBED_MODEL
    const sameDims = (row.image_embedding_dims ?? 0) === GEMINI_EMBED_DIMS
    return !(hasEmbedding && hasVectorColumn && sameFp && sameModel && sameDims)
  })

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
        const vec = await embedImageUrlWithGemini(imageUrl)
        if (!vec || vec.length === 0) {
          failed += 1
          await db
            .from('messaging_partner_inventory')
            .update({
              image_embedding_json: null,
              image_embedding_fingerprint: fp,
              image_embedding_model: GEMINI_EMBED_MODEL,
              image_embedding_dims: GEMINI_EMBED_DIMS,
              image_embedding_vec: null,
              image_embedding_updated_at: nowIso,
              image_embedding_error: 'FETCH_OR_EMBED_FAILED',
            })
            .eq('id', row.id)
            .eq('partner_id', partnerId)
          continue
        }
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
        const { error: upErr } = await db
          .from('messaging_partner_inventory')
          .update({
            image_embedding_json: vec,
            image_embedding_fingerprint: fp,
            image_embedding_model: GEMINI_EMBED_MODEL,
            image_embedding_dims: vec.length,
            image_embedding_vec: vec.length === DB_VECTOR_DIMS ? toPgVectorLiteral(vec) : null,
            image_embedding_updated_at: nowIso,
            image_embedding_error:
              vec.length === DB_VECTOR_DIMS ? '' : `VECTOR_DIM_MISMATCH:${vec.length}!=${DB_VECTOR_DIMS}`,
          })
          .eq('id', row.id)
          .eq('partner_id', partnerId)
        if (upErr) {
          failed += 1
          continue
        }
        synced += 1
      } catch (e) {
        failed += 1
        const msg = e instanceof Error ? e.message : String(e)
        await db
          .from('messaging_partner_inventory')
          .update({
            image_embedding_json: null,
            image_embedding_fingerprint: fp,
            image_embedding_model: GEMINI_EMBED_MODEL,
            image_embedding_dims: GEMINI_EMBED_DIMS,
            image_embedding_vec: null,
            image_embedding_updated_at: nowIso,
            image_embedding_error: msg.slice(0, 300),
          })
          .eq('id', row.id)
          .eq('partner_id', partnerId)
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
