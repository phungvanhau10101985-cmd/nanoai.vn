import {
  fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg,
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
  fetchPartnerInventorySliceByUpdatedAtAscFromPg,
  matchPartnerInventoryByTextEmbeddingFromPg,
  updatePartnerInventoryTextEmbeddingFieldsFromPg,
  type MessagingPartnerInventoryRow,
  type PartnerInventoryTextEmbeddingUpdatePatch,
} from '@/lib/db/messaging-partner-inventory-pg'
import { insertMessagingPartnerTextEmbedUsageFromPg } from '@/lib/db/messaging-partner-text-embed-usage-pg'
import { isPgConfigured } from '@/lib/db/pool'
import type { Database } from '@/types/database.types'

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
const DB_VECTOR_DIMS = 768

const GEMINI_EMBED_MODEL = process.env.GEMINI_IMAGE_EMBED_MODEL?.trim() || 'gemini-embedding-2-preview'
const GEMINI_EMBED_DIMS = Math.max(
  128,
  Math.min(3072, parseInt(process.env.GEMINI_IMAGE_EMBED_DIMS || '768', 10) || 768)
)
const MAX_PARALLEL = Math.max(
  1,
  Math.min(8, parseInt(process.env.GEMINI_TEXT_EMBED_PARALLEL || '4', 10) || 4)
)
const SYNC_LIMIT = Math.max(
  20,
  Math.min(5000, parseInt(process.env.GEMINI_TEXT_EMBED_SYNC_LIMIT || '1200', 10) || 1200)
)
const SCAN_PAGE_SIZE = Math.max(
  100,
  Math.min(5000, parseInt(process.env.GEMINI_TEXT_EMBED_SCAN_PAGE_SIZE || '1000', 10) || 1000)
)
const SCAN_MAX_ROWS = Math.max(
  1000,
  Math.min(200000, parseInt(process.env.GEMINI_TEXT_EMBED_SCAN_MAX_ROWS || '30000', 10) || 30000)
)

export type GeminiTextEmbedResult = {
  values: number[]
  promptTokens: number
  totalTokens: number
}

function toPgVectorLiteral(vec: number[]): string {
  return `[${vec.map((v) => (Number.isFinite(v) ? Number(v) : 0)).join(',')}]`
}

function vectorsEqual(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return false
  }
  return true
}

function parseNumericPriceToken(tok: string): number | null {
  const t = tok.trim().replace(/\s/g, '')
  if (!t) return null
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return parseInt(t.replace(/\./g, ''), 10)
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return parseInt(t.replace(/,/g, ''), 10)
  const v = parseFloat(t.replace(/,/g, '.'))
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Suy ra một mức giá VNĐ (đồng) từ chuỗi giá trong kho để nhân bản diễn đạt (đ / K / k / ngàn).
 * Tách biệt với parseVndAmountFromText (đơn hàng) — parser này hiểu k, ngàn, triệu, dấu . nghìn.
 */
export function tryParseVndAmountForEmbedding(raw: string): number | null {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (!s) return null

  // Triệu: 1,5 triệu / 1.5 triệu / 2tr / 2 triệu
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr(?:iệu)?)(?![a-z])/u)
  if (!m) m = s.match(/^(\d+(?:[.,]\d+)?)\s*tr\b/u)
  if (!m) m = s.match(/(\d+(?:[.,]\d+)?)\s*\bm\b/u)
  if (m) {
    const v = parseNumericPriceToken(m[1])
    if (v !== null) return Math.round(v * 1_000_000)
  }

  // Nghìn đồng: 700k, 700 k, 700kđ, 700 ngàn, 700 nghìn
  m = s.match(/(\d+(?:[.,]\d+)?)\s*k(?:đ|\b)/u) || s.match(/(\d+(?:[.,]\d+)?)\s*k\s*$/u)
  if (!m) m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:ngàn|nghìn)(?:\s|đ|\b|$)/u)
  if (m) {
    const v = parseNumericPriceToken(m[1])
    if (v !== null) return Math.round(v * 1000)
  }

  // Dạng 1.500.000 / 199.000 (dấu chấm phân cách nghìn)
  const compact = s.replace(/\s/g, '').replace(/đ/g, '')
  const vnGrouped = /^(\d{1,3}(?:\.\d{3})+)$/.exec(compact)
  if (vnGrouped) {
    const n = parseInt(vnGrouped[1].replace(/\./g, ''), 10)
    if (Number.isFinite(n) && n > 0) return n
  }

  // Chỉ số: 700000, 199000 (bỏ ký tự không phải chữ số)
  const digitsOnly = s.replace(/[^\d]/g, '')
  if (digitsOnly.length >= 5) {
    const n = parseInt(digitsOnly, 10)
    if (Number.isFinite(n) && n >= 10000) return n
  }
  // "700" + ngữ cảnh nghìn
  if (digitsOnly.length >= 1 && digitsOnly.length <= 4 && /k|ngàn|nghìn/u.test(s)) {
    const n = parseInt(digitsOnly, 10)
    if (Number.isFinite(n) && n > 0 && n < 100_000) return n * 1000
  }

  return null
}

function formatVndDotted(vnd: number): string {
  const n = Math.max(0, Math.round(vnd))
  return new Intl.NumberFormat('vi-VN').format(n)
}

function buildNormalizedPriceLines(priceHint: string): string[] {
  const raw = priceHint.trim()
  if (!raw) return []
  const lines: string[] = [`Giá trong kho (nguyên văn): ${raw}`]
  const vnd = tryParseVndAmountForEmbedding(raw)
  if (vnd === null || vnd <= 0) return lines

  const dotted = formatVndDotted(vnd)
  const thousands = vnd / 1000
  const kStr = Number.isInteger(thousands)
    ? String(thousands)
    : thousands.toFixed(2).replace(/\.?0+$/, '')
  const trieu = vnd / 1_000_000
  const trieuStr =
    trieu >= 1 && Number.isFinite(trieu)
      ? Number.isInteger(trieu)
        ? String(trieu)
        : trieu.toFixed(2).replace(/\.?0+$/, '')
      : ''

  lines.push(`Giá sản phẩm (đơn vị đồng VNĐ): ${vnd}đ; ${dotted}đ`)
  lines.push(
    `Đơn vị K (1K = 1000đ): ${kStr}K — tra cứu cùng mức giá: ${vnd} đồng | ${kStr}k | ${kStr} ngàn | ${kStr} nghìn | ${kStr} nghìn đồng`
  )
  if (trieuStr) {
    lines.push(`Quy đổi triệu đồng (1 triệu = 1.000.000đ): ${trieuStr} triệu`)
  }
  return lines
}

/**
 * Chuỗi đưa vào Gemini embed: tên + giá (trong kho + chuẩn đồng + K/k/ngàn) + ghi chú tư vấn.
 */
export function buildCatalogTextForEmbedding(
  row: Pick<InvRow, 'name' | 'price_hint' | 'consult_note'>
): string {
  const name = (row.name ?? '').trim()
  const priceHint = (row.price_hint ?? '').trim()
  const consult = (row.consult_note ?? '').trim()
  const parts: string[] = []
  if (name) parts.push(`Tên sản phẩm: ${name}`)
  if (priceHint) parts.push(...buildNormalizedPriceLines(priceHint))
  if (consult) parts.push(`Ghi chú tư vấn: ${consult}`)
  return parts.join('\n')
}

function textFingerprint(row: Pick<InvRow, 'name' | 'price_hint' | 'consult_note'>): string {
  return buildCatalogTextForEmbedding(row)
}

async function embedTextWithGemini(
  text: string,
  role: 'document' | 'query'
): Promise<GeminiTextEmbedResult> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing GOOGLE_API_KEY for Gemini text embeddings.')

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_EMBED_MODEL
  )}:embedContent?key=${encodeURIComponent(apiKey)}`

  const buildBody = (withTask: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {
      model: `models/${GEMINI_EMBED_MODEL}`,
      content: {
        parts: [{ text: text.slice(0, 8000) }],
      },
      outputDimensionality: GEMINI_EMBED_DIMS,
    }
    if (withTask) {
      b.taskType = role === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY'
    }
    return b
  }

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(true)),
  })
  let raw = await res.text()
  if (!res.ok && /task/i.test(raw)) {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(false)),
    })
    raw = await res.text()
  }
  if (!res.ok) {
    throw new Error(`Gemini text embed failed (${res.status}): ${raw.slice(0, 300)}`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Gemini text embed response is not valid JSON.')
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
    throw new Error('Gemini text embed response is missing embedding values.')
  }
  const um = p?.usageMetadata
  const promptTok = Math.max(1, um?.promptTokenCount ?? um?.totalTokenCount ?? 32)
  const totalTok = Math.max(1, um?.totalTokenCount ?? promptTok)
  return {
    values: values.map((v) => Number(v) || 0),
    promptTokens: promptTok,
    totalTokens: totalTok,
  }
}

function normalizeCustomerMessageForInventorySearch(raw: string): string {
  return raw.replace(/^📷\s*/u, '').replace(/\s+/g, ' ').trim()
}

/** Embed tin khách để so khớp ANN với kho (RETRIEVAL_QUERY). Trả null nếu không cấu hình API. */
export async function embedCustomerQueryTextForInventorySearch(
  customerMessage: string,
  options?: { partnerId?: string }
): Promise<number[] | null> {
  const t = normalizeCustomerMessageForInventorySearch(customerMessage)
  if (!t || t.length < 2) return null
  if (!process.env.GOOGLE_API_KEY?.trim()) return null
  try {
    const out = await embedTextWithGemini(t, 'query')
    const pid = options?.partnerId?.trim()
    if (pid && out.promptTokens > 0) {
      void insertMessagingPartnerTextEmbedUsageFromPg({
        partnerId: pid,
        source: 'customer_query',
        model: GEMINI_EMBED_MODEL,
        promptTokens: out.promptTokens,
        totalTokens: out.totalTokens,
      })
    }
    return out.values.length === GEMINI_EMBED_DIMS ? out.values : null
  } catch (e) {
    console.warn('[embedCustomerQueryTextForInventorySearch]', e)
    return null
  }
}

type TextEmbComparable = Pick<
  InvRow,
  | 'id'
  | 'partner_id'
  | 'name'
  | 'price_hint'
  | 'consult_note'
  | 'is_active'
  | 'text_embedding_json'
  | 'text_embedding_fingerprint'
  | 'text_embedding_model'
  | 'text_embedding_dims'
  | 'text_embedding_vec'
>

function needsTextEmbeddingSync(row: TextEmbComparable, force = false): boolean {
  if (!row.is_active) return false
  const catalog = buildCatalogTextForEmbedding(row)
  if (!catalog.trim()) return false
  if (force) return true
  const nextFp = textFingerprint(row)
  const hasEmbedding = Array.isArray(row.text_embedding_json)
  const hasVectorColumn = typeof row.text_embedding_vec === 'string' && row.text_embedding_vec.trim().length > 0
  const sameFp = row.text_embedding_fingerprint === nextFp
  const sameModel = (row.text_embedding_model ?? '') === GEMINI_EMBED_MODEL
  const sameDims = (row.text_embedding_dims ?? 0) === GEMINI_EMBED_DIMS
  return !(hasEmbedding && hasVectorColumn && sameFp && sameModel && sameDims)
}

export async function syncPartnerInventoryTextEmbeddings(
  partnerId: string,
  options?: { inventoryIds?: string[]; force?: boolean; limit?: number }
): Promise<{ ok: true; synced: number; failed: number; skipped: number } | { ok: false; error: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'Postgres (DATABASE_URL) is not configured.' }
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) {
    return { ok: false, error: 'Missing GOOGLE_API_KEY for Gemini text embeddings.' }
  }

  const cap = Math.max(1, Math.min(5000, options?.limit ?? SYNC_LIMIT))
  const idList = (options?.inventoryIds ?? []).map((x) => x.trim()).filter(Boolean)
  const rows: InvRow[] = []

  if (idList.length > 0) {
    const pgRows = await fetchPartnerInventoryRowsByIdsForEmbeddingSyncFromPg(partnerId, idList)
    if (pgRows === null) {
      return { ok: false, error: 'Could not load inventory rows for text embedding sync.' }
    }
    rows.push(...pgRows)
  } else {
    let scanned = 0
    let from = 0
    while (scanned < SCAN_MAX_ROWS && rows.length < cap) {
      const page = await fetchPartnerInventorySliceByUpdatedAtAscFromPg(partnerId, SCAN_PAGE_SIZE, from)
      if (page === null) {
        return { ok: false, error: 'Could not scan inventory for text embedding sync.' }
      }
      if (page.length === 0) break
      scanned += page.length
      for (const row of page) {
        if (needsTextEmbeddingSync(row, Boolean(options?.force))) rows.push(row)
        if (rows.length >= cap) break
      }
      if (page.length < SCAN_PAGE_SIZE) break
      from += SCAN_PAGE_SIZE
    }
  }

  const candidates = rows.filter((row) => needsTextEmbeddingSync(row, Boolean(options?.force)))
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
      const catalog = buildCatalogTextForEmbedding(row)
      const fp = textFingerprint(row)
      const nowIso = new Date().toISOString()
      try {
        if (!catalog.trim()) {
          failed += 1
          continue
        }
        const embedOut = await embedTextWithGemini(catalog, 'document')
        void insertMessagingPartnerTextEmbedUsageFromPg({
          partnerId,
          source: 'inventory_sync',
          model: GEMINI_EMBED_MODEL,
          promptTokens: embedOut.promptTokens,
          totalTokens: embedOut.totalTokens,
          inventoryId: row.id,
        })
        const vec = embedOut.values
        if (!vec || vec.length === 0) {
          failed += 1
          await updatePartnerInventoryTextEmbeddingFieldsFromPg(partnerId, row.id, {
            text_embedding_json: null,
            text_embedding_fingerprint: fp,
            text_embedding_model: GEMINI_EMBED_MODEL,
            text_embedding_dims: GEMINI_EMBED_DIMS,
            text_embedding_vec: null,
            text_embedding_updated_at: nowIso,
            text_embedding_error: 'EMBED_EMPTY',
          })
          continue
        }
        if (
          Array.isArray(row.text_embedding_json) &&
          vectorsEqual(row.text_embedding_json as number[], vec) &&
          row.text_embedding_fingerprint === fp &&
          row.text_embedding_model === GEMINI_EMBED_MODEL &&
          row.text_embedding_dims === vec.length &&
          typeof row.text_embedding_vec === 'string' &&
          row.text_embedding_vec.trim().length > 0
        ) {
          synced += 1
          continue
        }
        const patch: PartnerInventoryTextEmbeddingUpdatePatch = {
          text_embedding_json: vec,
          text_embedding_fingerprint: fp,
          text_embedding_model: GEMINI_EMBED_MODEL,
          text_embedding_dims: vec.length,
          text_embedding_vec: vec.length === DB_VECTOR_DIMS ? toPgVectorLiteral(vec) : null,
          text_embedding_updated_at: nowIso,
          text_embedding_error:
            vec.length === DB_VECTOR_DIMS ? '' : `VECTOR_DIM_MISMATCH:${vec.length}!=${DB_VECTOR_DIMS}`,
        }
        const upOk = await updatePartnerInventoryTextEmbeddingFieldsFromPg(partnerId, row.id, patch)
        if (!upOk) {
          failed += 1
          continue
        }
        synced += 1
      } catch (e) {
        failed += 1
        const msg = e instanceof Error ? e.message : String(e)
        await updatePartnerInventoryTextEmbeddingFieldsFromPg(partnerId, row.id, {
          text_embedding_json: null,
          text_embedding_fingerprint: fp,
          text_embedding_model: GEMINI_EMBED_MODEL,
          text_embedding_dims: GEMINI_EMBED_DIMS,
          text_embedding_vec: null,
          text_embedding_updated_at: nowIso,
          text_embedding_error: msg.slice(0, 300),
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

/**
 * Top‑k mặt hàng theo embedding văn bản (đã embed sẵn tên + giá + ghi chú tư vấn).
 * Trả rỗng nếu chưa có GOOGLE_API_KEY / chưa sync text / lỗi API.
 */
export async function fetchInventoryRowsBySemanticTextForPartnerAi(
  partnerId: string,
  customerMessage: string,
  limit: number
): Promise<MessagingPartnerInventoryRow[]> {
  const vec = await embedCustomerQueryTextForInventorySearch(customerMessage, { partnerId })
  if (!vec || vec.length !== DB_VECTOR_DIMS) return []
  const literal = toPgVectorLiteral(vec)
  const lim = Math.max(1, Math.min(50, Math.floor(limit)))
  const matches = await matchPartnerInventoryByTextEmbeddingFromPg(partnerId, literal, lim, 0)
  if (!matches?.length) return []
  const ids = matches.map((m) => m.inventory_id)
  const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(partnerId, ids)
  return rows ?? []
}
