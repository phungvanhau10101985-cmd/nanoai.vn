/**
 * Kiểm hàng giả bằng một file batch Gemini 3.8 Flash, xong rồi mới bản địa hóa.
 * Kết quả có thể về trong vòng 24 giờ. Logo hãng thì bỏ khỏi hàng đợi ảnh và feed.
 */
import sharp from 'sharp'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { partnerShopEmailBrandName } from '@/lib/messaging/partner-shop-email-brand'
import { collectInventoryImageRefs, uniqueImageUrls } from './collect-image-refs'
import type { ImageLocJob } from './image-localization-types'
import {
  fetchImageLocJobFromPg,
  updateImageLocJobFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'

export const COUNTERFEIT_CHECK_PHASE = 'counterfeit_check'
const MODEL = 'gemini-3.8-flash'
const CHUNK = 30
/** Một JPEG luôn 1120 token. 3 ảnh: logo còn đủ lớn, vẫn thấy ảnh chính và 2 ảnh kế. */
const MAX_IMAGES = 3
const POLL_GAP_MS = 120_000

const PROMPT = [
  'Ảnh là một hoặc nhiều ảnh sản phẩm xếp dọc.',
  'Chỉ tìm logo thương hiệu nổi tiếng, kể cả logo bị vẽ méo và không có chữ tên hãng.',
  'Bỏ qua chữ mô tả, bảng size và hướng dẫn giặt.',
  'Trả JSON duy nhất {"brands":["Nike"]}. Không có logo thì {"brands":[]}.',
  'Không giải thích.',
].join('\n')

type GateState = {
  batch_name: string
  chunk_ids: string[]
  next_index: number
  flagged_ids: string[]
  held_ids: string[]
  applied_batches: string[]
  last_poll_at: string
}

export type CounterfeitListItem = {
  id: string
  sku: string
  name: string
  image_url: string
  brands: string[]
}

function emptyGate(): GateState {
  return {
    batch_name: '',
    chunk_ids: [],
    next_index: 0,
    flagged_ids: [],
    held_ids: [],
    applied_batches: [],
    last_poll_at: '',
  }
}

function payloadRecord(job: ImageLocJob): Record<string, unknown> {
  return job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
    ? { ...(job.payload as Record<string, unknown>) }
    : {}
}

function readGate(job: ImageLocJob): GateState {
  const raw = payloadRecord(job).counterfeit_gate
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyGate()
  const row = raw as Partial<GateState>
  const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [])
  return {
    batch_name: String(row.batch_name || ''),
    chunk_ids: list(row.chunk_ids),
    next_index: Number(row.next_index) || 0,
    flagged_ids: list(row.flagged_ids),
    held_ids: list(row.held_ids),
    applied_batches: list(row.applied_batches),
    last_poll_at: String(row.last_poll_at || ''),
  }
}

export function parseBrandJson(text: string): string[] | null {
  let raw = (text || '').trim()
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      data = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as { brands?: unknown; brand?: unknown }
  const brands = record.brands ?? (record.brand ? [record.brand] : null)
  if (!Array.isArray(brands)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of brands) {
    const token = String(item || '').trim()
    const key = token.toLocaleLowerCase()
    if (!token || seen.has(key)) continue
    seen.add(key)
    out.push(token)
    if (out.length >= 12) break
  }
  return out
}

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
}

function responseText(line: Record<string, unknown>): string {
  const response = (line.response || {}) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const parts = response.candidates?.[0]?.content?.parts || []
  return parts.map((part) => String(part?.text || '')).join('\n')
}

export async function readCounterfeitBrands(partnerId: string, inventoryId: string): Promise<string[]> {
  try {
    const row = await pgQueryOne<{ counterfeit_risk: unknown }>(
      `select counterfeit_risk from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId]
    )
    return brandsFromFlag(row?.counterfeit_risk)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
    if (code === '42703') return []
    throw error
  }
}

export function counterfeitWasChecked(flag: unknown): boolean {
  if (!flag || typeof flag !== 'object' || Array.isArray(flag)) return false
  const checked = (flag as { checked?: unknown }).checked
  return checked === true || checked === 'true'
}

export function brandsFromFlag(flag: unknown): string[] {
  if (!flag || typeof flag !== 'object' || Array.isArray(flag)) return []
  const row = flag as { risk?: unknown; brands?: unknown }
  if (row.risk !== true || !Array.isArray(row.brands)) return []
  return row.brands.map((item) => String(item || '').trim()).filter(Boolean)
}

export async function listCounterfeitProducts(partnerId: string, limit = 100): Promise<CounterfeitListItem[]> {
  try {
    const rows = await pgQuery<{ id: string; sku: string; name: string; image_url: string; counterfeit_risk: unknown }>(
      `select id::text as id, coalesce(sku, '') as sku, coalesce(name, '') as name,
              coalesce(image_url, '') as image_url, counterfeit_risk
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and counterfeit_risk->>'risk' = 'true'
       order by updated_at desc
       limit $2`,
      [partnerId, Math.min(5000, Math.max(1, limit))]
    )
    return rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      image_url: row.image_url,
      brands: brandsFromFlag(row.counterfeit_risk),
    }))
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : ''
    if (code === '42703') return []
    throw error
  }
}

export async function counterfeitInventoryIdSet(partnerId: string): Promise<Set<string>> {
  const rows = await listCounterfeitProducts(partnerId, 5000)
  return new Set(rows.map((row) => row.id))
}

/** Hàng chưa kiểm sạch hoặc chưa bản địa hóa — không vào nguồn cấp dữ liệu. */
export async function distributionPendingInventoryIdSet(partnerId: string): Promise<Set<string>> {
  const { inventoryVectorReadySql } = await import('@/lib/messaging/inventory-image-embedding-gate')
  const rows = await pgQuery<{ id: string }>(
    `select id::text as id
     from public.messaging_partner_inventory
     where partner_id = $1::uuid
       and not (${inventoryVectorReadySql('')})`,
    [partnerId]
  )
  return new Set(rows.map((row) => row.id))
}

export async function advanceCounterfeitGate(job: ImageLocJob): Promise<'waiting' | 'ready' | 'failed'> {
  const fresh = (await fetchImageLocJobFromPg(job.partner_id, job.job_id)) || job
  if (fresh.cancel_requested || fresh.status === 'cancelled') return 'failed'
  if (fresh.phase !== COUNTERFEIT_CHECK_PHASE) return 'ready'
  const gate = readGate(fresh)
  const queue = fresh.queue_product_ids
  if (gate.batch_name) {
    const polled = Date.parse(gate.last_poll_at)
    if (Number.isFinite(polled) && Date.now() - polled < POLL_GAP_MS) return 'waiting'
    gate.last_poll_at = new Date().toISOString()
    await saveGate(fresh, gate, 'Đang chờ Gemini 3.8 Flash kiểm hàng giả trước khi bản địa hóa.')
    const status = await pollBatch(gate.batch_name)
    if (status === 'running' || status === 'pending' || status === 'unknown') return 'waiting'
    if (status === 'failed') {
      await updateImageLocJobFromPg(fresh.partner_id, fresh.job_id, {
        status: 'error',
        phase: 'error',
        message: 'Kiểm hàng giả lỗi. Chưa bản địa hóa ảnh.',
        finished_at: new Date().toISOString(),
      })
      return 'failed'
    }
    const finished = gate.chunk_ids.length
    if (!gate.applied_batches.includes(gate.batch_name)) {
      await applyBatchOutput(fresh, gate)
      gate.applied_batches.push(gate.batch_name)
    }
    gate.batch_name = ''
    gate.chunk_ids = []
    gate.next_index += finished
  }
  if (gate.next_index >= queue.length) {
    await releaseGate(fresh, gate)
    return 'ready'
  }
  const chunk = queue.slice(gate.next_index, gate.next_index + CHUNK)
  const built = await buildJsonl(fresh.partner_id, chunk)
  if (!built.jsonl) {
    gate.next_index += chunk.length
    await saveGate(fresh, gate, 'Một nhóm sản phẩm không có ảnh để kiểm. Đang chuyển nhóm sau.')
    return advanceCounterfeitGate(fresh)
  }
  const name = await createBatch(built.jsonl)
  gate.batch_name = name
  gate.chunk_ids = built.sentIds
  gate.next_index += chunk.length - built.sentIds.length
  gate.last_poll_at = new Date().toISOString()
  const wave = Math.floor(gate.next_index / CHUNK) + 1
  const waves = Math.max(1, Math.ceil(queue.length / CHUNK))
  await saveGate(fresh, gate, `Đã gửi file batch Gemini 3.8 Flash (${wave}/${waves}) trước khi bản địa hóa.`)
  return 'waiting'
}

async function releaseGate(job: ImageLocJob, gate: GateState): Promise<void> {
  const processed = unique([...(job.processed_product_ids || []), ...gate.flagged_ids, ...gate.held_ids])
  const reports = [...(job.skipped_product_reports || [])]
  const seen = new Set(reports.map((row) => row.product_id))
  for (const id of gate.flagged_ids) {
    if (seen.has(id)) continue
    reports.push({ product_id: id, message: 'Nghi hàng giả — không bản địa hóa.' })
  }
  for (const id of gate.held_ids) {
    if (seen.has(id)) continue
    reports.push({ product_id: id, message: 'Không đọc được kết quả kiểm hàng giả — không bản địa hóa.' })
  }
  const payload = payloadRecord(job)
  delete payload.counterfeit_gate
  await updateImageLocJobFromPg(job.partner_id, job.job_id, {
    status: 'queued',
    phase: 'queued',
    message:
      gate.flagged_ids.length > 0
        ? `Đã loại ${gate.flagged_ids.length} sản phẩm nghi hàng giả. Bắt đầu bản địa hóa ảnh còn lại.`
        : 'Đã kiểm hàng giả. Bắt đầu bản địa hóa ảnh.',
    payload,
    processed_product_ids: processed,
    skipped: Math.max(job.skipped, gate.flagged_ids.length + gate.held_ids.length),
    skipped_product_reports: reports.slice(-120),
  })
}

async function saveGate(job: ImageLocJob, gate: GateState, message: string): Promise<void> {
  const payload = payloadRecord(job)
  payload.counterfeit_gate = gate
  await updateImageLocJobFromPg(job.partner_id, job.job_id, {
    status: 'running',
    phase: COUNTERFEIT_CHECK_PHASE,
    message,
    payload,
    processed_product_ids: unique([...(job.processed_product_ids || []), ...gate.flagged_ids, ...gate.held_ids]),
    skipped: gate.flagged_ids.length + gate.held_ids.length,
  })
  job.phase = COUNTERFEIT_CHECK_PHASE
  job.payload = payload
}

async function applyBatchOutput(job: ImageLocJob, gate: GateState): Promise<void> {
  const raw = await downloadBatch(gate.batch_name)
  const newlyFlagged: Array<{ id: string; brands: string[] }> = []
  const seen = new Set(gate.chunk_ids)
  const returned = new Set<string>()
  for (const line of raw.split('\n')) {
    const text = line.trim()
    if (!text) continue
    let item: Record<string, unknown>
    try {
      item = JSON.parse(text) as Record<string, unknown>
    } catch {
      continue
    }
    const inventoryId = String(item.key || '').trim()
    if (!inventoryId || !seen.has(inventoryId)) continue
    returned.add(inventoryId)
    if (item.error) {
      if (!gate.held_ids.includes(inventoryId)) gate.held_ids.push(inventoryId)
      continue
    }
    const brands = parseBrandJson(responseText(item))
    if (brands == null) {
      if (!gate.held_ids.includes(inventoryId)) gate.held_ids.push(inventoryId)
      continue
    }
    if (brands.length) {
      await writeFlag(job.partner_id, inventoryId, brands)
      if (!gate.flagged_ids.includes(inventoryId)) {
        gate.flagged_ids.push(inventoryId)
        newlyFlagged.push({ id: inventoryId, brands })
      }
    } else {
      await writeFlag(job.partner_id, inventoryId, [])
    }
  }
  for (const inventoryId of gate.chunk_ids) {
    if (!returned.has(inventoryId) && !gate.held_ids.includes(inventoryId) && !gate.flagged_ids.includes(inventoryId)) {
      gate.held_ids.push(inventoryId)
    }
  }
  if (newlyFlagged.length) await notifyCounterfeit(job, newlyFlagged)
}

async function writeFlag(partnerId: string, inventoryId: string, brands: string[]): Promise<void> {
  const flag = {
    risk: brands.length > 0,
    brands,
    source: MODEL,
    checked: true,
    checked_at: new Date().toISOString(),
  }
  await pgQuery(
    `update public.messaging_partner_inventory
     set counterfeit_risk = $3::jsonb,
         image_localization_status = case when $4::boolean then 'skipped' else image_localization_status end,
         image_localization_error = case when $4::boolean then $5 else image_localization_error end,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [partnerId, inventoryId, JSON.stringify(flag), brands.length > 0, brands.length ? `Nghi hàng giả: ${brands.join(', ')}` : null]
  )
}

async function notifyCounterfeit(job: ImageLocJob, rows: Array<{ id: string; brands: string[] }>): Promise<void> {
  try {
    const partners = await fetchMessagingPartnersByIdsFromPg([job.partner_id])
    const partner = partners?.[0]
    const shop = partnerShopEmailBrandName(partner)
    const preview = rows
      .slice(0, 5)
      .map((row) => `${row.id}: ${row.brands.join(', ')}`)
      .join('; ')
    const body = `${shop}: ${rows.length} sản phẩm có logo hãng trước khi bản địa hóa. Không xử lý ảnh và không đưa vào feed. ${preview}`
    const admins = await pgQuery<{ id: string }>(`select id::text as id from public.profiles where role = 'admin'`)
    const owner = await pgQueryOne<{ id: string }>(
      `select owner_user_id::text as id from public.messaging_partners where id = $1::uuid`,
      [job.partner_id]
    )
    const users = new Set<string>()
    for (const admin of admins) if (admin.id) users.add(admin.id)
    if (owner?.id) users.add(owner.id)
    await Promise.all(
      [...users].map((userId) =>
        deliverUserNotificationPg({
          user_id: userId,
          type: 'inventory_counterfeit',
          title: 'Nghi hàng giả',
          body: body.slice(0, 500),
          meta: {
            push_url: `/dashboard/messaging/settings?section=inventory-image-loc&partner=${encodeURIComponent(job.partner_id)}`,
            partner_id: job.partner_id,
            job_id: job.job_id,
            idempotency_key: `counterfeit:${job.job_id}:${rows[0]?.id || 'batch'}`.slice(0, 240),
          },
        })
      )
    )
  } catch (error) {
    console.warn('[counterfeit-gate] notify', error)
  }
}

async function buildJsonl(partnerId: string, ids: string[]): Promise<{ jsonl: string; sentIds: string[] }> {
  const lines: string[] = []
  const sentIds: string[] = []
  for (const inventoryId of ids) {
    const row = await pgQueryOne<{
      image_url: string | null
      colors_json: unknown
      gallery_urls: unknown
      detail_image_urls: unknown
      material_detail_image_url: string | null
      counterfeit_risk: unknown
    }>(
      `select image_url, colors_json, gallery_urls, detail_image_urls, material_detail_image_url, counterfeit_risk
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, inventoryId]
    )
    if (!row || counterfeitWasChecked(row.counterfeit_risk)) continue
    const urls = uniqueImageUrls(collectInventoryImageRefs(row), MAX_IMAGES)
    const blobs: Buffer[] = []
    for (const url of urls) {
      try {
        blobs.push(await fetchImageWith1688Bypass(url, { timeoutMs: 20_000, maxBytes: 8_000_000 }))
      } catch {
        continue
      }
      if (blobs.length >= MAX_IMAGES) break
    }
    const jpeg = await stitchJpeg(blobs)
    if (!jpeg.length) continue
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } },
          ],
        },
      ],
      generation_config: {
        temperature: 0,
        max_output_tokens: 256,
        response_mime_type: 'application/json',
      },
    }
    lines.push(JSON.stringify({ key: inventoryId, request }))
    sentIds.push(inventoryId)
  }
  return { jsonl: lines.join('\n'), sentIds }
}

async function stitchJpeg(blobs: Buffer[]): Promise<Buffer> {
  const frames: Buffer[] = []
  for (const raw of blobs) {
    try {
      frames.push(
        await sharp(raw, { failOn: 'none' })
          .rotate()
          .resize({ width: 800, height: 900, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
      )
    } catch {
      continue
    }
  }
  if (!frames.length) return Buffer.alloc(0)
  if (frames.length === 1) return frames[0]
  const metas = await Promise.all(frames.map(async (frame) => sharp(frame).metadata()))
  const width = Math.max(...metas.map((meta) => meta.width || 1))
  const gap = 8
  const height = metas.reduce((sum, meta) => sum + (meta.height || 1), 0) + gap * (frames.length - 1)
  let top = 0
  const layers = frames.map((frame, index) => {
    const layer = { input: frame, top, left: Math.floor((width - (metas[index]?.width || 1)) / 2) }
    top += (metas[index]?.height || 1) + gap
    return layer
  })
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(layers)
    .jpeg({ quality: 75 })
    .toBuffer()
}

async function createBatch(jsonl: string): Promise<string> {
  const key = geminiKey()
  if (key.length < 10) {
    const { notifyAiDown, AiApiStopped } = await import('@/lib/ai/ai-run-alert')
    await notifyAiDown('Gemini', 'Thiếu GEMINI_API_KEY')
    throw new AiApiStopped('AI_API_STOPPED Gemini: thiếu GEMINI_API_KEY — không bản địa hóa khi chưa kiểm hàng giả.')
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ file: { display_name: 'nanoai-counterfeit.jsonl' } })], { type: 'application/json' }))
  form.append('data', new Blob([jsonl], { type: 'application/jsonl' }), 'counterfeit.jsonl')
  const uploaded = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'multipart' },
    body: form,
  })
  if (!uploaded.ok) throw new Error(`Upload batch hàng giả lỗi ${uploaded.status}`)
  const uploadedBody = (await uploaded.json()) as { file?: { name?: string } }
  const fileName = String(uploadedBody.file?.name || '')
  if (!fileName) throw new Error('Upload batch hàng giả không trả tên file')
  const created = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchGenerateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batch: { display_name: 'nanoai-counterfeit', input_config: { file_name: fileName } },
    }),
  })
  if (!created.ok) throw new Error(`Tạo batch hàng giả lỗi ${created.status}`)
  const body = (await created.json()) as { name?: string; batch?: { name?: string } }
  const name = String(body.name || body.batch?.name || '')
  if (!name) throw new Error('Tạo batch hàng giả không trả name')
  return name
}

async function pollBatch(name: string): Promise<'running' | 'pending' | 'succeeded' | 'failed' | 'unknown'> {
  const key = geminiKey()
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    headers: { 'x-goog-api-key': key },
  })
  if (!response.ok) return 'unknown'
  const body = (await response.json()) as Record<string, unknown>
  const token = batchState(body).toUpperCase()
  if (token.includes('SUCCESS') || token.includes('SUCCEED')) return 'succeeded'
  if (token.includes('FAIL') || token.includes('CANCEL') || token.includes('EXPIR')) return 'failed'
  if (token.includes('RUNNING') || token.includes('PROCESSING')) return 'running'
  if (token.includes('PENDING') || token.includes('QUEUED')) return 'pending'
  return 'unknown'
}

function batchState(body: Record<string, unknown>): string {
  const nodes = [body.state, body.status]
  const metadata = body.metadata
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    nodes.push((metadata as { state?: unknown }).state)
  }
  for (const node of nodes) {
    if (typeof node === 'string' && node) return node
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const named = node as { name?: unknown; state?: unknown }
      const value = String(named.name || named.state || '')
      if (value) return value
    }
  }
  return ''
}

async function downloadBatch(name: string): Promise<string> {
  const key = geminiKey()
  const info = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
    headers: { 'x-goog-api-key': key },
  })
  if (!info.ok) throw new Error(`Không đọc được batch hàng giả ${info.status}`)
  const fileName = findOutputFile(await info.json())
  if (!fileName) throw new Error('Batch hàng giả không có file kết quả')
  const file = await fetch(
    `https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`,
    { headers: { 'x-goog-api-key': key } }
  )
  if (!file.ok) throw new Error(`Tải kết quả hàng giả lỗi ${file.status}`)
  return file.text()
}

function findOutputFile(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findOutputFile(item)
      if (found) return found
    }
    return ''
  }
  const record = node as Record<string, unknown>
  for (const key of ['responsesFile', 'responses_file', 'fileName', 'file_name', 'file']) {
    const value = record[key]
    if (typeof value === 'string' && value.startsWith('files/')) return value
  }
  for (const value of Object.values(record)) {
    const found = findOutputFile(value)
    if (found) return found
  }
  return ''
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
}
