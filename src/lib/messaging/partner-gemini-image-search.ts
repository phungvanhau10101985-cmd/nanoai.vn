import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRemoteImageForCatalog, sniffImageContentType } from '@/lib/fetch-image-1688'
import { trackApiUsage } from '@/lib/track-ai-usage'
import type { Database } from '@/types/database.types'
import { embedImageBufferWithGemini } from '@/lib/messaging/partner-inventory-embedding'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
type Db = SupabaseClient<Database>

export type GeminiImageSearchCandidate = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  price_hint?: string
  score?: number
}

type EmbeddingVector = number[]
type CacheItem = { value: EmbeddingVector; expiresAt: number }

const GEMINI_EMBED_MODEL = process.env.GEMINI_IMAGE_EMBED_MODEL?.trim() || 'gemini-embedding-2-preview'
const INVENTORY_SCAN_LIMIT = Math.max(
  20,
  Math.min(1500, parseInt(process.env.GEMINI_IMAGE_SEARCH_SCAN_LIMIT || '1200', 10) || 1200)
)
const MAX_PARALLEL = Math.max(
  1,
  Math.min(8, parseInt(process.env.GEMINI_IMAGE_SEARCH_PARALLEL || '4', 10) || 4)
)
const DB_VECTOR_DIMS = 768
const SEARCH_MIN_SCORE = Math.max(
  0,
  Math.min(1, parseFloat(process.env.GEMINI_IMAGE_SEARCH_MIN_SCORE || '0') || 0)
)
const CACHE_TTL_MS = Math.max(
  60_000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    parseInt(process.env.GEMINI_IMAGE_EMBED_CACHE_TTL_MS || String(24 * 60 * 60 * 1000), 10) ||
      24 * 60 * 60 * 1000
  )
)

const imageEmbedCache = new Map<string, CacheItem>()
const inflightImageEmbed = new Map<string, Promise<EmbeddingVector | null>>()

function normalizeUrlForCache(raw: string): string {
  return raw.trim()
}

function detectImageMimeType(buf: Buffer): string {
  return sniffImageContentType(buf) || 'image/jpeg'
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i += 1) {
    const av = a[i] || 0
    const bv = b[i] || 0
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  if (na <= 0 || nb <= 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function getOrCreateUrlEmbedding(imageUrl: string): Promise<EmbeddingVector | null> {
  const key = normalizeUrlForCache(imageUrl)
  const now = Date.now()
  const hit = imageEmbedCache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const inflight = inflightImageEmbed.get(key)
  if (inflight) return inflight

  const task = (async () => {
    const img = await fetchRemoteImageForCatalog(key, { timeoutMs: 12_000 })
    if (!img) return null
    const vec = await embedImageBufferWithGemini(img.buf, img.contentType || detectImageMimeType(img.buf))
    imageEmbedCache.set(key, { value: vec, expiresAt: now + CACHE_TTL_MS })
    return vec
  })()
    .catch(() => null)
    .finally(() => {
      inflightImageEmbed.delete(key)
    })

  inflightImageEmbed.set(key, task)
  return task
}

export async function geminiProductSearchFromImageBuffer(
  imageBuffer: Buffer,
  partnerId: string,
  inventoryRows: InvRow[],
  options?: { maxResults?: number; userId?: string | null }
): Promise<{ candidates: GeminiImageSearchCandidate[]; error?: string }> {
  try {
    void partnerId
    const queryMime = detectImageMimeType(imageBuffer)
    const queryVec = await embedImageBufferWithGemini(imageBuffer, queryMime)

    const rows = inventoryRows
      .filter((r) => r.is_active && /^https?:\/\//i.test((r.image_url || '').trim()))
      .slice(0, INVENTORY_SCAN_LIMIT)
    if (rows.length === 0) return { candidates: [] }

    const scored: Array<{ row: InvRow; score: number }> = []
    let cursor = 0

    const workers = Array.from({ length: Math.min(MAX_PARALLEL, rows.length) }, async () => {
      while (true) {
        const idx = cursor
        cursor += 1
        if (idx >= rows.length) break
        const row = rows[idx]
        const invVec = Array.isArray(row.image_embedding_json)
          ? (row.image_embedding_json as number[])
          : await getOrCreateUrlEmbedding(row.image_url)
        if (!invVec) continue
        const sim = cosineSimilarity(queryVec, invVec)
        if (Number.isFinite(sim)) scored.push({ row, score: sim })
      }
    })
    await Promise.all(workers)

    scored.sort((a, b) => b.score - a.score || a.row.sort_order - b.row.sort_order)
    const maxResults = Math.min(25, Math.max(1, Math.floor(options?.maxResults ?? 8)))
    const top = scored.slice(0, maxResults)

    void trackApiUsage({
      userId: options?.userId ?? null,
      model: GEMINI_EMBED_MODEL,
      feature: 'image_similarity_search',
      promptTokenCount: 0,
      candidatesTokenCount: top.length,
      totalTokenCount: 1,
    })

    return {
      candidates: top.map(({ row, score }) => {
        const purl = row.product_url?.trim() ?? ''
        return {
          inventoryId: row.id,
          name: row.name,
          sku: row.sku,
          image_url: row.image_url ?? '',
          ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
          ...(row.price_hint?.trim() ? { price_hint: row.price_hint.trim() } : {}),
          score,
        }
      }),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { candidates: [], error: msg }
  }
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => (Number.isFinite(v) ? Number(v) : 0)).join(',')}]`
}

/**
 * Preferred path for large catalogs: ANN search in Postgres (pgvector index).
 * Falls back to app-side scan only when RPC/vector path is unavailable.
 */
export async function geminiProductSearchFromImageBufferViaVectorDb(
  db: Db,
  imageBuffer: Buffer,
  partnerId: string,
  options?: { maxResults?: number; userId?: string | null }
): Promise<{ candidates: GeminiImageSearchCandidate[]; error?: string }> {
  try {
    const queryMime = detectImageMimeType(imageBuffer)
    const queryVec = await embedImageBufferWithGemini(imageBuffer, queryMime)
    const maxResults = Math.min(25, Math.max(1, Math.floor(options?.maxResults ?? 8)))

    if (queryVec.length === DB_VECTOR_DIMS) {
      const { data, error } = await db.rpc('match_messaging_partner_inventory_by_embedding', {
        p_partner_id: partnerId,
        p_query: toPgVectorLiteral(queryVec),
        p_limit: maxResults,
        p_min_score: SEARCH_MIN_SCORE,
      })

      if (!error && Array.isArray(data)) {
        const ids = data.map((row) => row.inventory_id)
        const priceById = new Map<string, string>()
        if (ids.length > 0) {
          const { data: pricedRows } = await db
            .from('messaging_partner_inventory')
            .select('id, price_hint')
            .eq('partner_id', partnerId)
            .in('id', ids)
          for (const r of pricedRows ?? []) {
            priceById.set(r.id, r.price_hint ?? '')
          }
        }

        const candidates: GeminiImageSearchCandidate[] = data.map((row) => {
          const purl = row.product_url?.trim() ?? ''
          const ph = priceById.get(row.inventory_id)?.trim() ?? ''
          return {
            inventoryId: row.inventory_id,
            name: row.name,
            sku: row.sku,
            image_url: row.image_url ?? '',
            ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
            ...(ph ? { price_hint: ph } : {}),
            score: typeof row.score === 'number' ? row.score : undefined,
          }
        })
        void trackApiUsage({
          userId: options?.userId ?? null,
          model: GEMINI_EMBED_MODEL,
          feature: 'image_similarity_search',
          promptTokenCount: 0,
          candidatesTokenCount: candidates.length,
          totalTokenCount: 1,
        })
        return { candidates }
      }

      if (error) {
        console.error('[image-search] vector-rpc fallback', {
          partnerId,
          error: error.message,
        })
      }
    }

    // Fallback path when vector dims mismatch or RPC/index not available.
    const { data: invRows } = await db
      .from('messaging_partner_inventory')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .limit(Math.max(INVENTORY_SCAN_LIMIT, maxResults))

    return geminiProductSearchFromImageBuffer(imageBuffer, partnerId, invRows ?? [], options)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { candidates: [], error: msg }
  }
}

export function clearGeminiImageEmbeddingCache() {
  imageEmbedCache.clear()
  inflightImageEmbed.clear()
}
