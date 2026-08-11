import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  jsonToLandingSectionData,
  type LandingAiSectionRow,
  type LandingAiSectionStatus,
  type LandingAiSectionType,
  type LandingSectionData,
} from '@/lib/partner-website/landing/landing-ai-types'
import type { Json } from '@/types/database.types'

/** L3.1 — CRUD section cố định (hero/highlights/material/products_grid/trust_cta/faq) cho 1 landing. */

type SectionDbRow = {
  id: string
  landing_id: string
  section_type: string
  order_index: number
  status: string
  data: unknown
  prompt_used: string | null
  error_message: string | null
  created_at: unknown
  updated_at: unknown
}

const SELECT_COLS = `id::text, landing_id::text, section_type, order_index, status, data, prompt_used,
  error_message, created_at, updated_at`

function mapSectionRow(r: SectionDbRow): LandingAiSectionRow {
  return {
    id: r.id,
    landingId: r.landing_id,
    sectionType: r.section_type as LandingAiSectionType,
    orderIndex: Number(r.order_index ?? 0) || 0,
    status: r.status as LandingAiSectionStatus,
    data: jsonToLandingSectionData((r.data ?? {}) as Json),
    promptUsed: r.prompt_used,
    errorMessage: r.error_message,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export async function listLandingSectionsPg(landingId: string): Promise<LandingAiSectionRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<SectionDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_landing_sections
       where landing_id = $1::uuid order by order_index asc`,
      [landingId]
    )
    return rows.map(mapSectionRow)
  } catch (e) {
    console.error('[messaging-partner-landing-sections-pg] listLandingSectionsPg', e)
    return []
  }
}

/** Idempotent — chèn các section còn thiếu theo plan cố định (không đụng section đã có data). */
export async function ensureDefaultLandingSectionsPg(
  landingId: string,
  plan: LandingAiSectionType[]
): Promise<LandingAiSectionRow[]> {
  if (!isPgConfigured()) return []
  try {
    for (let i = 0; i < plan.length; i++) {
      await pgQuery(
        `insert into public.messaging_partner_landing_sections (landing_id, section_type, order_index, status, data)
         values ($1::uuid, $2, $3, $4, '{}'::jsonb)
         on conflict (landing_id, section_type) do nothing`,
        [landingId, plan[i], i, plan[i] === 'products_grid' ? 'ready' : 'pending']
      )
    }
    return await listLandingSectionsPg(landingId)
  } catch (e) {
    console.error('[messaging-partner-landing-sections-pg] ensureDefaultLandingSectionsPg', e)
    return []
  }
}

export async function fetchLandingSectionByIdPg(
  landingId: string,
  sectionId: string
): Promise<LandingAiSectionRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<SectionDbRow>(
      `select ${SELECT_COLS} from public.messaging_partner_landing_sections
       where landing_id = $1::uuid and id = $2::uuid limit 1`,
      [landingId, sectionId]
    )
    return row ? mapSectionRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-sections-pg] fetchLandingSectionByIdPg', e)
    return null
  }
}

export async function updateLandingSectionPg(input: {
  landingId: string
  sectionId: string
  status?: LandingAiSectionStatus
  data?: LandingSectionData
  promptUsed?: string | null
  errorMessage?: string | null
}): Promise<LandingAiSectionRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchLandingSectionByIdPg(input.landingId, input.sectionId)
  if (!existing) return null
  const next = {
    status: input.status ?? existing.status,
    data: input.data ?? existing.data,
    promptUsed: input.promptUsed !== undefined ? input.promptUsed : existing.promptUsed,
    errorMessage: input.errorMessage !== undefined ? input.errorMessage : existing.errorMessage,
  }
  try {
    const row = await pgQueryOne<SectionDbRow>(
      `update public.messaging_partner_landing_sections set
         status = $3, data = $4::jsonb, prompt_used = $5, error_message = $6
       where landing_id = $1::uuid and id = $2::uuid
       returning ${SELECT_COLS}`,
      [input.landingId, input.sectionId, next.status, JSON.stringify(next.data), next.promptUsed, next.errorMessage]
    )
    return row ? mapSectionRow(row) : null
  } catch (e) {
    console.error('[messaging-partner-landing-sections-pg] updateLandingSectionPg', e)
    return null
  }
}

/** Merge tay (giữ nguyên field không được gửi) — dùng cho "sửa tay override" trong panel admin. */
export async function mergeManualLandingSectionDataPg(
  landingId: string,
  sectionId: string,
  patch: Record<string, unknown>
): Promise<LandingAiSectionRow | null> {
  const existing = await fetchLandingSectionByIdPg(landingId, sectionId)
  if (!existing) return null
  const merged = { ...(existing.data as Record<string, unknown>), ...patch }
  return updateLandingSectionPg({
    landingId,
    sectionId,
    data: merged as LandingSectionData,
    status: existing.status === 'pending' ? 'ready' : existing.status,
  })
}
