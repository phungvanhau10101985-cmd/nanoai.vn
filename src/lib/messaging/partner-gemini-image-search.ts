import { fetchRemoteImageForCatalog, sniffImageContentType } from '@/lib/fetch-image-1688'
import { trackApiUsage } from '@/lib/track-ai-usage'
import type { Database } from '@/types/database.types'
import {
  colorImageUrlsForInventorySearch,
  fetchPartnerInventoryDefaultForAiFromPg,
  fetchPartnerInventorySearchEnrichmentByIdsFromPg,
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
  matchPartnerInventoryByEmbeddingFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { insertMessagingPartnerImageEmbedUsageFromPg } from '@/lib/db/messaging-partner-image-embed-usage-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  embedImageBufferWithGemini,
  type GeminiImageEmbedResult,
} from '@/lib/messaging/partner-inventory-embedding'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

export type GeminiImageSearchCandidate = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  price_hint?: string
  /** JSON màu trong cột kho `stock_note` (Excel) — [{ name, img }]. */
  color_variants?: Array<{ name: string; img: string }>
  /** Ảnh phụ từ kho: material_detail + real_use (khác JSON màu ở stock_note). */
  color_image_urls?: string[]
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

async function getOrCreateUrlEmbedding(
  imageUrl: string,
  partnerId: string
): Promise<EmbeddingVector | null> {
  const key = normalizeUrlForCache(imageUrl)
  const now = Date.now()
  const hit = imageEmbedCache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const inflight = inflightImageEmbed.get(key)
  if (inflight) return inflight

  const task = (async () => {
    const img = await fetchRemoteImageForCatalog(key, { timeoutMs: 12_000 })
    if (!img) return null
    const res = await embedImageBufferWithGemini(img.buf, img.contentType || detectImageMimeType(img.buf))
    void insertMessagingPartnerImageEmbedUsageFromPg({
      partnerId,
      source: 'guest_image_search',
      model: GEMINI_EMBED_MODEL,
      promptTokens: res.promptTokens,
      totalTokens: res.totalTokens,
    })
    imageEmbedCache.set(key, { value: res.values, expiresAt: now + CACHE_TTL_MS })
    return res.values
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
  options?: {
    maxResults?: number
    userId?: string | null
    /** Đã embed ảnh truy vấn (tránh gọi API lặp khi fallback từ ViaVectorDb). */
    queryEmbedPregen?: GeminiImageEmbedResult
  }
): Promise<{ candidates: GeminiImageSearchCandidate[]; error?: string }> {
  try {
    const queryMime = detectImageMimeType(imageBuffer)
    const queryRes =
      options?.queryEmbedPregen ?? (await embedImageBufferWithGemini(imageBuffer, queryMime))
    if (!options?.queryEmbedPregen) {
      void insertMessagingPartnerImageEmbedUsageFromPg({
        partnerId,
        source: 'guest_image_search',
        model: GEMINI_EMBED_MODEL,
        promptTokens: queryRes.promptTokens,
        totalTokens: queryRes.totalTokens,
      })
    }
    const queryVec = queryRes.values

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
          : await getOrCreateUrlEmbedding(row.image_url, partnerId)
        if (!invVec) continue
        const sim = cosineSimilarity(queryVec, invVec)
        if (Number.isFinite(sim)) scored.push({ row, score: sim })
      }
    })
    await Promise.all(workers)

    scored.sort((a, b) => b.score - a.score || a.row.sort_order - b.row.sort_order)
    const maxResults = Math.min(
      PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
      Math.max(1, Math.floor(options?.maxResults ?? 8))
    )
    const top = scored.slice(0, maxResults)

    void trackApiUsage({
      userId: options?.userId ?? null,
      model: GEMINI_EMBED_MODEL,
      feature: 'image_similarity_search',
      promptTokenCount: queryRes.promptTokens,
      candidatesTokenCount: top.length,
      totalTokenCount: Math.max(1, queryRes.totalTokens),
    })

    return {
      candidates: top.map(({ row, score }) => {
        const purl = row.product_url?.trim() ?? ''
        const mainImg = row.image_url ?? ''
        const color_image_urls = colorImageUrlsForInventorySearch(
          mainImg,
          row.material_detail_image_url,
          row.real_use_image_url,
          row.real_use_image_url_2
        )
        const color_variants = parseColorVariantsJson(row.stock_note ?? '')
        return {
          inventoryId: row.id,
          name: row.name,
          sku: row.sku,
          image_url: mainImg,
          ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
          ...(row.price_hint?.trim() ? { price_hint: row.price_hint.trim() } : {}),
          ...(color_variants.length > 0 ? { color_variants } : {}),
          ...(color_image_urls.length > 0 ? { color_image_urls } : {}),
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
  imageBuffer: Buffer,
  partnerId: string,
  options?: { maxResults?: number; userId?: string | null }
): Promise<{ candidates: GeminiImageSearchCandidate[]; error?: string }> {
  try {
    const queryMime = detectImageMimeType(imageBuffer)
    const queryRes = await embedImageBufferWithGemini(imageBuffer, queryMime)
    void insertMessagingPartnerImageEmbedUsageFromPg({
      partnerId,
      source: 'guest_image_search',
      model: GEMINI_EMBED_MODEL,
      promptTokens: queryRes.promptTokens,
      totalTokens: queryRes.totalTokens,
    })
    const queryVec = queryRes.values
    const maxResults = Math.min(
      PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
      Math.max(1, Math.floor(options?.maxResults ?? getPartnerPublicInventorySearchDefaultLimit()))
    )

    if (queryVec.length === DB_VECTOR_DIMS) {
      const qLit = toPgVectorLiteral(queryVec)
      let data:
        | Array<{
            inventory_id: string
            name: string
            sku: string | null
            image_url: string
            product_url: string | null
            score: number
          }>
        | null = null

      if (isPgConfigured()) {
        const fromPg = await matchPartnerInventoryByEmbeddingFromPg(
          partnerId,
          qLit,
          maxResults,
          SEARCH_MIN_SCORE
        )
        if (fromPg !== null) {
          data = fromPg.map((row) => ({
            inventory_id: row.inventory_id,
            name: row.name,
            sku: row.sku,
            image_url: row.image_url,
            product_url: row.product_url,
            score: row.score,
          }))
        }
      }

      if (data !== null) {
        const ids = data.map((row) => row.inventory_id)
        const enrichById =
          ids.length > 0 && isPgConfigured()
            ? await fetchPartnerInventorySearchEnrichmentByIdsFromPg(partnerId, ids)
            : null

        const candidates: GeminiImageSearchCandidate[] = data.map((row) => {
          const purl = row.product_url?.trim() ?? ''
          const mainImg = row.image_url ?? ''
          const en = enrichById?.get(row.inventory_id)
          const ph = en?.price_hint?.trim() ?? ''
          const color_image_urls = en
            ? colorImageUrlsForInventorySearch(
                mainImg,
                en.material_detail_image_url,
                en.real_use_image_url,
                en.real_use_image_url_2
              )
            : []
          const color_variants = en ? parseColorVariantsJson(en.stock_note) : []
          return {
            inventoryId: row.inventory_id,
            name: row.name,
            sku: row.sku,
            image_url: mainImg,
            ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
            ...(ph ? { price_hint: ph } : {}),
            ...(color_variants.length > 0 ? { color_variants } : {}),
            ...(color_image_urls.length > 0 ? { color_image_urls } : {}),
            score: typeof row.score === 'number' ? row.score : undefined,
          }
        })
        void trackApiUsage({
          userId: options?.userId ?? null,
          model: GEMINI_EMBED_MODEL,
          feature: 'image_similarity_search',
          promptTokenCount: queryRes.promptTokens,
          candidatesTokenCount: candidates.length,
          totalTokenCount: Math.max(1, queryRes.totalTokens),
        })
        return { candidates }
      }
    }

    // Fallback path when vector dims mismatch or RPC/index not available.
    const scanLimit = Math.max(INVENTORY_SCAN_LIMIT, maxResults)
    let invRows: InvRow[] | null = null
    if (isPgConfigured()) {
      try {
        invRows = await fetchPartnerInventoryDefaultForAiFromPg(partnerId, scanLimit)
      } catch (e) {
        console.warn('[image-search] scan inventory PG failed', e)
      }
    }
    if (invRows === null) invRows = []

    return geminiProductSearchFromImageBuffer(imageBuffer, partnerId, invRows, {
      ...options,
      queryEmbedPregen: queryRes,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { candidates: [], error: msg }
  }
}

/**
 * Thẻ «Tư vấn» không khớp URL/SKU tĩnh: embed ảnh trên thẻ → ANN pgvector trên kho (vector ảnh đã sync).
 */
export async function fetchTopInventoryRowByConsultCardImageVectorAnn(
  partnerId: string,
  imageUrl: string
): Promise<InvRow | null> {
  if (!isPgConfigured()) return null
  const u = imageUrl.trim()
  if (!/^https?:\/\//i.test(u)) return null
  try {
    const img = await fetchRemoteImageForCatalog(u, { timeoutMs: 12_000 })
    if (!img) return null
    const res = await geminiProductSearchFromImageBufferViaVectorDb(img.buf, partnerId, { maxResults: 1 })
    if (res.error || !res.candidates?.length) return null
    const id = res.candidates[0].inventoryId
    if (!id) return null
    const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, [id])
    return rows?.[0] ?? null
  } catch (e) {
    console.warn('[fetchTopInventoryRowByConsultCardImageVectorAnn]', e)
    return null
  }
}

export function clearGeminiImageEmbeddingCache() {
  imageEmbedCache.clear()
  inflightImageEmbed.clear()
}

/**
 * Lấy danh sách mặt hàng **tương tự ảnh** so với một SP neo (embedding ảnh chính của anchor → ANN trên pgvector).
 * Ưu tiên `image_embedding_json` đã sync; không có thì tải `image_url` và embed một lần.
 * Bỏ qua chính `anchorRow` trong kết quả (trừ khi DB trả trùng id).
 */
export async function fetchInventoryRowsSimilarToAnchorProductImage(
  partnerId: string,
  anchorRow: InvRow,
  options?: { limit?: number }
): Promise<InvRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(
    PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
    Math.max(1, Math.floor(options?.limit ?? 20))
  )
  const fetchLim = limit + 6

  let queryVec: number[] | null = null
  if (Array.isArray(anchorRow.image_embedding_json)) {
    const j = anchorRow.image_embedding_json as number[]
    if (j.length === DB_VECTOR_DIMS) queryVec = j
  }
  if (!queryVec) {
    const url = (anchorRow.image_url ?? '').trim()
    if (!/^https?:\/\//i.test(url)) return []
    const img = await fetchRemoteImageForCatalog(url, { timeoutMs: 12_000 })
    if (!img) return []
    const mime = img.contentType || detectImageMimeType(img.buf)
    try {
      const res = await embedImageBufferWithGemini(img.buf, mime)
      queryVec = res.values
      void insertMessagingPartnerImageEmbedUsageFromPg({
        partnerId,
        source: 'guest_image_search',
        model: GEMINI_EMBED_MODEL,
        promptTokens: res.promptTokens,
        totalTokens: res.totalTokens,
        inventoryId: anchorRow.id,
      })
    } catch {
      return []
    }
  }

  if (!queryVec || queryVec.length !== DB_VECTOR_DIMS) return []

  const qLit = toPgVectorLiteral(queryVec)
  const matches = await matchPartnerInventoryByEmbeddingFromPg(partnerId, qLit, fetchLim, SEARCH_MIN_SCORE)
  if (!matches?.length) return []

  const anchorId = anchorRow.id
  const ids = matches.map((m) => m.inventory_id).filter((id) => id !== anchorId).slice(0, limit)
  if (ids.length === 0) return []

  const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, ids)
  return rows ?? []
}
