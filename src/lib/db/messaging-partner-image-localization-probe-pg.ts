import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { IMAGE_LOC_PROBE_STALE_MS } from '@/lib/messaging/image-localization/probe-report'
import type {
  ImageLocProbe,
  ImageLocProbeEngine,
  ImageLocProbeImage,
  ImageLocProbeLogLine,
  ImageLocProbeStatus,
} from '@/lib/messaging/image-localization/image-localization-types'

export type { ImageLocProbe }

type ProbeRow = {
  id: string
  partner_id: string
  status: string
  language: string
  apparel_sheet: boolean
  engine: string | null
  model: string | null
  classify_type: string | null
  classify_reason: string | null
  message: string | null
  log_json: unknown
  original_url: string | null
  result_url: string | null
  original_path: string | null
  result_path: string | null
  created_at: string
  finished_at: string | null
  expires_at: string
}

function asLog(raw: unknown): ImageLocProbeLogLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((line) => {
      if (!line || typeof line !== 'object') return null
      const row = line as { at?: unknown; text?: unknown }
      const text = String(row.text || '').trim()
      if (!text) return null
      return { at: String(row.at || ''), text }
    })
    .filter((line): line is ImageLocProbeLogLine => Boolean(line))
}

function asEngine(raw: string | null): ImageLocProbeEngine | null {
  if (raw === 'local' || raw === 'ai' || raw === 'keep' || raw === 'delete') return raw
  return null
}

export function mapImageLocProbe(row: ProbeRow): ImageLocProbe {
  const images: ImageLocProbeImage[] = []
  if (row.original_url) images.push({ role: 'original', url: row.original_url })
  if (row.result_url && row.result_url !== row.original_url) images.push({ role: 'result', url: row.result_url })
  const status: ImageLocProbeStatus = row.status === 'running' || row.status === 'error' ? row.status : 'done'
  return {
    id: row.id,
    partner_id: row.partner_id,
    status,
    language: row.language,
    apparel_sheet: Boolean(row.apparel_sheet),
    engine: asEngine(row.engine),
    model: row.model,
    classify_type: row.classify_type,
    classify_reason: row.classify_reason,
    message: row.message,
    log: asLog(row.log_json),
    images,
    created_at: row.created_at,
    finished_at: row.finished_at,
    expires_at: row.expires_at,
  }
}

const PROBE_COLUMNS = `id::text, partner_id::text, status, language, apparel_sheet, engine, model,
  classify_type, classify_reason, message, log_json, original_url, result_url, original_path, result_path,
  created_at, finished_at, expires_at`

export async function insertImageLocProbe(input: {
  id: string
  partnerId: string
  language: string
  apparelSheet: boolean
  expiresAt: Date
}): Promise<ImageLocProbe> {
  const rows = await pgQuery<ProbeRow>(
    `insert into public.messaging_partner_image_localization_probes
       (id, partner_id, status, language, apparel_sheet, log_json, expires_at)
     values ($1::uuid, $2::uuid, 'running', $3, $4, '[]'::jsonb, $5)
     returning ${PROBE_COLUMNS}`,
    [input.id, input.partnerId, input.language, input.apparelSheet, input.expiresAt.toISOString()]
  )
  return mapImageLocProbe(rows[0])
}

export async function appendImageLocProbeLog(partnerId: string, id: string, text: string): Promise<void> {
  const line = JSON.stringify([{ at: new Date().toISOString(), text }])
  await pgQuery(
    `update public.messaging_partner_image_localization_probes
        set log_json = coalesce(log_json, '[]'::jsonb) || $3::jsonb,
            updated_at = now()
      where partner_id = $1::uuid and id = $2::uuid`,
    [partnerId, id, line]
  )
}

export async function updateImageLocProbe(
  partnerId: string,
  id: string,
  patch: {
    engine?: string | null
    model?: string | null
    classifyType?: string | null
    classifyReason?: string | null
    originalUrl?: string | null
    originalPath?: string | null
    resultUrl?: string | null
    resultPath?: string | null
    message?: string | null
    status?: ImageLocProbeStatus
  }
): Promise<void> {
  await pgQuery(
    `update public.messaging_partner_image_localization_probes
        set engine = coalesce($3, engine),
            model = coalesce($4, model),
            classify_type = coalesce($5, classify_type),
            classify_reason = coalesce($6, classify_reason),
            original_url = coalesce($7, original_url),
            original_path = coalesce($8, original_path),
            result_url = coalesce($9, result_url),
            result_path = coalesce($10, result_path),
            message = coalesce($11, message),
            status = coalesce($12, status),
            finished_at = case when $12 in ('done', 'error') then now() else finished_at end,
            updated_at = now()
      where partner_id = $1::uuid and id = $2::uuid and status = 'running'`,
    [
      partnerId,
      id,
      patch.engine ?? null,
      patch.model ?? null,
      patch.classifyType ?? null,
      patch.classifyReason ?? null,
      patch.originalUrl ?? null,
      patch.originalPath ?? null,
      patch.resultUrl ?? null,
      patch.resultPath ?? null,
      patch.message ?? null,
      patch.status ?? null,
    ]
  )
}

export async function listImageLocProbes(partnerId: string, limit = 40): Promise<ImageLocProbe[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<ProbeRow>(
    `select ${PROBE_COLUMNS}
       from public.messaging_partner_image_localization_probes
      where partner_id = $1::uuid and expires_at > now()
      order by created_at desc
      limit $2`,
    [partnerId, limit]
  )
  return rows.map(mapImageLocProbe)
}

export async function findRunningImageLocProbe(partnerId: string): Promise<string | null> {
  const row = await pgQueryOne<{ id: string }>(
    `select id::text as id
       from public.messaging_partner_image_localization_probes
      where partner_id = $1::uuid
        and status = 'running'
        and created_at > now() - ($2::text || ' milliseconds')::interval
      limit 1`,
    [partnerId, String(IMAGE_LOC_PROBE_STALE_MS)]
  )
  return row?.id ?? null
}

export async function listExpiredImageLocProbeFiles(): Promise<
  Array<{ id: string; partner_id: string; original_url: string | null; result_url: string | null; original_path: string | null; result_path: string | null }>
> {
  return pgQuery(
    `delete from public.messaging_partner_image_localization_probes
      where expires_at <= now()
      returning id::text, partner_id::text, original_url, result_url, original_path, result_path`
  )
}

export async function markStaleImageLocProbes(): Promise<number> {
  const rows = await pgQuery<{ id: string }>(
    `update public.messaging_partner_image_localization_probes
        set status = 'error',
            message = 'Tiến trình thử bị dừng.',
            finished_at = now(),
            updated_at = now(),
            log_json = coalesce(log_json, '[]'::jsonb) || $1::jsonb
      where status = 'running'
        and created_at <= now() - ($2::text || ' milliseconds')::interval
      returning id::text`,
    [JSON.stringify([{ at: new Date().toISOString(), text: 'Tiến trình thử bị dừng vì chạy quá lâu.' }]), String(IMAGE_LOC_PROBE_STALE_MS)]
  )
  return rows.length
}

export async function deleteImageLocProbe(partnerId: string, id: string): Promise<ProbeRow | null> {
  return pgQueryOne<ProbeRow>(
    `delete from public.messaging_partner_image_localization_probes
      where partner_id = $1::uuid and id = $2::uuid
      returning ${PROBE_COLUMNS}`,
    [partnerId, id]
  )
}
