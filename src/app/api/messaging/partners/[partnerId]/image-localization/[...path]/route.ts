import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteImageLocJobFromPg,
  deleteTerminalImageLocJobsFromPg,
  fetchImageLocJobFromPg,
  fetchImageLocProductReportFromPg,
  fetchImageLocSettingsFromPg,
  imageLocSummaryFromPg,
  listImageLocJobsFromPg,
  upsertImageLocSettingsFromPg,
} from '@/lib/db/messaging-partner-image-localization-pg'
import { buildImageLocAuthStatus } from '@/lib/messaging/image-localization/image-localization-auth'
import {
  cancelImageLocalizationJob,
  startImageLocalizationJob,
} from '@/lib/messaging/image-localization/job-runtime'
import {
  IMAGE_LOC_LANGUAGES,
  IMAGE_LOC_RESUMABLE_JOB_STATUSES,
  type ImageLocLanguage,
  type ImageLocStartPayload,
} from '@/lib/messaging/image-localization/image-localization-types'
import { ImageLocalizationError } from '@/lib/messaging/image-localization/gemini-adapter'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const maxDuration = 300
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ partnerId: string; path: string[] }> }

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured', userId: '' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error, userId: '' }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'inventory')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error, userId: '' }
  return { ok: true as const, userId: auth.user.id }
}

function joinPath(parts: string[] | undefined): string {
  return (parts || []).map((p) => decodeURIComponent(p)).join('/')
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ ok: false, error: detail, detail }, { status })
}

function boolParam(v: string | null, fallback = false): boolean {
  if (v == null) return fallback
  return !['0', 'false', 'no', 'off'].includes(v.trim().toLowerCase())
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)
  const url = new URL(req.url)

  if (p === 'settings/gemini-auth') {
    const settings = await fetchImageLocSettingsFromPg(partnerId)
    return NextResponse.json(buildImageLocAuthStatus(settings.deepseek_off_peak_only))
  }

  if (p === 'summary') {
    return NextResponse.json(await imageLocSummaryFromPg(partnerId))
  }

  if (p === 'jobs') {
    const limit = Number(url.searchParams.get('limit') || '40')
    const activeOnly = boolParam(url.searchParams.get('active_only'), false)
    return NextResponse.json(await listImageLocJobsFromPg(partnerId, { limit, activeOnly }))
  }

  const jobGet = /^jobs\/([^/]+)$/.exec(p)
  if (jobGet) {
    const job = await fetchImageLocJobFromPg(partnerId, jobGet[1])
    if (!job) return jsonError('Không tìm thấy job bản địa hóa ảnh', 404)
    return NextResponse.json(job)
  }

  const report = /^products\/([^/]+)\/report$/.exec(p)
  if (report) {
    const row = await fetchImageLocProductReportFromPg(partnerId, report[1])
    if (!row) return jsonError('Không tìm thấy sản phẩm.', 404)
    return NextResponse.json(row)
  }

  return jsonError('Not found', 404)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)

  if (p === 'jobs') {
    let body: ImageLocStartPayload
    try {
      body = (await req.json()) as ImageLocStartPayload
    } catch {
      return jsonError('JSON không hợp lệ')
    }
    const language = String(body.language || 'vi').trim().toLowerCase() as ImageLocLanguage
    if (!(IMAGE_LOC_LANGUAGES as readonly string[]).includes(language)) {
      return jsonError('Ngôn ngữ không hỗ trợ. Dùng vi, en, th hoặc id.')
    }
    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids.map((id) => String(id).trim()).filter(Boolean)
      : undefined
    try {
      const out = await startImageLocalizationJob(
        partnerId,
        {
          language,
          force: Boolean(body.force),
          dry_run: Boolean(body.dry_run),
          product_ids: productIds?.length ? productIds : null,
          limit: body.limit ?? null,
          gemini_mode: body.gemini_mode === 'openai' ? 'openai' : body.gemini_mode === 'api' ? 'api' : null,
          gemini_image_model: body.gemini_image_model ?? null,
          gemini_image_size: body.gemini_image_size ?? null,
          openai_image_model: body.openai_image_model ?? null,
          openai_image_quality: body.openai_image_quality ?? null,
          openai_image_size: body.openai_image_size ?? null,
          allow_ai_image_models: body.allow_ai_image_models ?? null,
        },
        auth.userId
      )
      return NextResponse.json(out)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = e instanceof ImageLocalizationError ? 400 : 500
      return jsonError(msg, status)
    }
  }

  const cancel = /^jobs\/([^/]+)\/cancel$/.exec(p)
  if (cancel) {
    const modeRaw = new URL(req.url).searchParams.get('mode') || 'graceful'
    const mode = modeRaw === 'force' ? 'force' : 'graceful'
    const job = await cancelImageLocalizationJob(partnerId, cancel[1], mode)
    if (!job) return jsonError('Không tìm thấy job bản địa hóa ảnh', 404)
    return NextResponse.json(job)
  }

  return jsonError('Not found', 404)
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)
  if (p !== 'settings/deepseek-off-peak') return jsonError('Not found', 404)
  let body: { enabled?: unknown }
  try {
    body = (await req.json()) as { enabled?: unknown }
  } catch {
    return jsonError('JSON không hợp lệ')
  }
  await upsertImageLocSettingsFromPg(partnerId, Boolean(body.enabled))
  const settings = await fetchImageLocSettingsFromPg(partnerId)
  return NextResponse.json({ deepseek_pricing: buildImageLocAuthStatus(settings.deepseek_off_peak_only).deepseek_pricing })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)

  if (p === 'jobs/terminal') {
    const deleted = await deleteTerminalImageLocJobsFromPg(partnerId)
    return NextResponse.json({ deleted })
  }

  const one = /^jobs\/([^/]+)$/.exec(p)
  if (one) {
    const job = await fetchImageLocJobFromPg(partnerId, one[1])
    if (!job) return jsonError('Không tìm thấy job bản địa hóa ảnh', 404)
    if (IMAGE_LOC_RESUMABLE_JOB_STATUSES.has((job.status || '').toLowerCase())) {
      return jsonError('Job đang chạy — hãy hủy trước khi xóa.', 409)
    }
    const ok = await deleteImageLocJobFromPg(partnerId, one[1])
    if (!ok) return jsonError('Không xóa được job.', 409)
    return NextResponse.json({ deleted: true, job_id: one[1] })
  }

  return jsonError('Not found', 404)
}
