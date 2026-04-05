import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { enqueueVisionCatalogBackgroundSyncJob } from '@/lib/messaging/partner-vision-bg-sync-enqueue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron VPS (vd. 1 lần/ngày): tự **xếp hàng** đồng bộ nền Vision (`queued`) cho mọi shop đã bật gợi ý theo ảnh.
 * Không xử lý import — job do `/api/cron/vision-catalog-sync` (mỗi vài phút) nhặt.
 *
 * GET hoặc POST + `Authorization: Bearer <secret>`
 * - Mặc định dùng `VISION_BG_SYNC_ENQUEUE_CRON_SECRET` nếu set; không thì dùng `VISION_CATALOG_SYNC_CRON_SECRET`.
 * - `?partner_id=<uuid>` — chỉ xếp hàng một shop (tuỳ chọn).
 */
function resolveEnqueueSecret(): string | undefined {
  return (
    process.env.VISION_BG_SYNC_ENQUEUE_CRON_SECRET?.trim() ||
    process.env.VISION_CATALOG_SYNC_CRON_SECRET?.trim()
  )
}

async function handleCron(req: NextRequest) {
  const secret = resolveEnqueueSecret()
  if (!secret) {
    return NextResponse.json(
      {
        error:
          'VISION_CATALOG_SYNC_CRON_SECRET or VISION_BG_SYNC_ENQUEUE_CRON_SECRET must be configured.',
      },
      { status: 503 }
    )
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  const onlyPartner = req.nextUrl.searchParams.get('partner_id')?.trim() || null

  try {
    if (onlyPartner) {
      const r = await enqueueVisionCatalogBackgroundSyncJob(db, onlyPartner, null)
      if (r.ok) {
        return NextResponse.json({ ok: true, enqueued: 1, skipped: 0, errors: [] as string[] })
      }
      if (r.code === 'already_active') {
        return NextResponse.json({ ok: true, enqueued: 0, skipped: 1, errors: [] as string[], note: r.error })
      }
      const status = r.code === 'no_ai_row' ? 404 : 400
      return NextResponse.json({ ok: false, error: r.error, code: r.code }, { status })
    }

    const { data: rows, error: listErr } = await db
      .from('messaging_partner_ai_settings')
      .select('partner_id')
      .eq('vision_product_search_enabled', true)

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 })
    }

    let enqueued = 0
    let skipped = 0
    const errors: string[] = []
    for (const row of rows ?? []) {
      const pid = row.partner_id
      const r = await enqueueVisionCatalogBackgroundSyncJob(db, pid, null)
      if (r.ok) enqueued += 1
      else if (r.code === 'already_active') skipped += 1
      else if (r.code === 'vision_disabled') skipped += 1
      else errors.push(`${pid}: ${r.error}`)
    }

    return NextResponse.json({ ok: true, enqueued, skipped, errors })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error('[cron/vision-bg-sync-enqueue]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
