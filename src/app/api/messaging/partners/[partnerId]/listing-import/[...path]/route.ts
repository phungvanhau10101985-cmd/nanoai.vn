import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchListingImportDraftFromPg,
  fetchListingImportDraftsByIdsFromPg,
  fetchListingImportSettingsFromPg,
  listingParserIdsExistingInInventoryFromPg,
  listingParserIdsWithDoneDraftsFromPg,
  loadListingImportQueueFromPg,
  upsertListingImportSettingsFromPg,
} from '@/lib/db/messaging-partner-listing-import-pg'
import {
  collectTerminalDraftIdsFromQueue,
  deleteListingImportQueue,
  enqueueListingImport,
  exportListingImportSnapshotCsv,
  getListingImportStatus,
  listListingImportRuns,
  pauseListingImport,
  resumeListingImport,
  stopListingImport,
} from '@/lib/messaging/listing-import/listing-import-queue'
import { listingImportProductsXlsxBuffer, listingLinkTemplateXlsxBuffer } from '@/lib/messaging/listing-import/listing-import-xlsx'
import {
  listingImportCookieSettingsMeta,
  loadListingImportCookies,
  parseCookieText,
} from '@/lib/messaging/listing-import/listing-import-cookies'
import { publishListingImportDraft } from '@/lib/messaging/listing-import/publish-draft'
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

export async function GET(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)

  if (p === 'listing-queue/runs') {
    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') || '50')
    const offset = Number(url.searchParams.get('offset') || '0')
    const data = await listListingImportRuns(partnerId, { limit, offset })
    return NextResponse.json(data)
  }

  const queueGet = /^listing-queue\/([a-f0-9]{32,64})$/.exec(p)
  if (queueGet) {
    try {
      return NextResponse.json(await getListingImportStatus(partnerId, queueGet[1]))
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e), 404)
    }
  }

  const csv = /^listing-queue\/([a-f0-9]{32,64})\/export\.csv$/.exec(p)
  if (csv) {
    const url = new URL(req.url)
    const finishedOnly = url.searchParams.get('finished_only') === 'true'
    try {
      const text = await exportListingImportSnapshotCsv(partnerId, csv[1], finishedOnly)
      const suffix = finishedOnly ? '_ket_qua' : '_snapshot'
      return new NextResponse(`\ufeff${text.replace(/^\ufeff/, '')}`, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="listing_import_queue_${csv[1].slice(0, 12)}${suffix}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e), 404)
    }
  }

  const xlsx = /^listing-queue\/([a-f0-9]{32,64})\/export-products\.xlsx$/.exec(p)
  if (xlsx) {
    try {
      const q = await loadListingImportQueueFromPg(partnerId, xlsx[1])
      if (!q) return jsonError('Không tìm thấy hàng đợi.', 404)
      const ids = collectTerminalDraftIdsFromQueue(q)
      if (!ids.length) return jsonError('Đợt này chưa có draft nào (chưa có dòng done/error ghi draft_id).')
      const byId = await fetchListingImportDraftsByIdsFromPg(partnerId, ids)
      const rows: Record<string, unknown>[] = []
      for (const id of ids) {
        const d = byId.get(id)
        if (d?.product_data) rows.push(d.product_data)
      }
      if (!rows.length) {
        return jsonError('Không xuất được dòng Excel nào từ nháp của đợt này.')
      }
      const buf = listingImportProductsXlsxBuffer(rows)
      const filename = `listing_queue_products_${xlsx[1].slice(0, 12)}.xlsx`
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e), 500)
    }
  }

  const draftGet = /^drafts\/([0-9a-f-]{36})$/i.exec(p)
  if (draftGet) {
    const draft = await fetchListingImportDraftFromPg(partnerId, draftGet[1])
    if (!draft) return jsonError('Không tìm thấy draft.', 404)
    return NextResponse.json(draft)
  }

  if (p === 'settings/cookie') {
    const cookies = await loadListingImportCookies(partnerId)
    const saved = await fetchListingImportSettingsFromPg(partnerId)
    return NextResponse.json({
      ...listingImportCookieSettingsMeta(cookies),
      pandamall_username: saved?.pandamall_username || '',
      has_pandamall_password: Boolean(saved?.pandamall_password?.trim()),
    })
  }

  return jsonError('Not found', 404)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)

  if (p === 'settings/cookie') {
    const body = (await req.json().catch(() => ({}))) as {
      cookie_text?: string
      pandamall_username?: string
      pandamall_password?: string
    }
    let cookieJson: unknown[] | undefined
    if (typeof body.cookie_text === 'string' && body.cookie_text.trim()) {
      try {
        cookieJson = parseCookieText(body.cookie_text)
      } catch (e) {
        return jsonError(e instanceof Error ? e.message : String(e))
      }
      if (!cookieJson.length) return jsonError('Cookie trống hoặc không đọc được name/value (cần domain trong JSON export).')
    }
    const saved = await upsertListingImportSettingsFromPg({
      partnerId,
      cookieJson,
      pandamallUsername: body.pandamall_username,
      pandamallPassword: body.pandamall_password,
    })
    if (!saved) {
      return jsonError('Không lưu được cookie. Chạy migration listing_import_settings rồi thử lại.', 503)
    }
    const cookies = await loadListingImportCookies(partnerId)
    return NextResponse.json({
      ...listingImportCookieSettingsMeta(cookies, 'Đã lưu cookie / tài khoản PandaMall.'),
      pandamall_username: saved.pandamall_username,
      has_pandamall_password: Boolean(saved.pandamall_password?.trim()),
    })
  }

  if (p === 'listing-parser-db-presence') {
    const body = (await req.json().catch(() => ({}))) as {
      ids?: string[]
      include_done_drafts?: boolean
      products_active_only?: boolean
    }
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
    if (ids.length > 2000) return jsonError('Tối đa 2000 id mỗi lần gọi.')
    const existing = await listingParserIdsExistingInInventoryFromPg({
      partnerId,
      ids,
      activeOnly: Boolean(body.products_active_only),
    })
    const merged = new Set(existing)
    if (body.include_done_drafts !== false) {
      const drafts = await listingParserIdsWithDoneDraftsFromPg(partnerId, ids)
      for (const id of drafts) merged.add(id)
    }
    return NextResponse.json({ existing_normalized: [...merged].sort() })
  }

  if (p === 'listing-queue/enqueue') {
    const body = (await req.json().catch(() => ({}))) as {
      queue_token?: string | null
      items?: Array<{
        url?: string
        source?: string
        label?: string | null
        chinese_name?: string | null
        shop_name_chinese?: string | null
        price?: number | null
        pro_lower_price?: string | null
        pro_high_price?: string | null
      }>
    }
    const items = (body.items || []).map((it) => ({
      url: String(it.url || '').trim(),
      source: it.source,
      label: it.label,
      chinese_name: it.chinese_name,
      shop_name_chinese: it.shop_name_chinese,
      price: it.price,
      pro_lower_price: it.pro_lower_price,
      pro_high_price: it.pro_high_price,
    }))
    try {
      const out = await enqueueListingImport(partnerId, body.queue_token, items, auth.userId)
      return NextResponse.json(out)
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e))
    }
  }

  const pause = /^listing-queue\/([a-f0-9]{32,64})\/pause$/.exec(p)
  if (pause) {
    try {
      return NextResponse.json(await pauseListingImport(partnerId, pause[1]))
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e))
    }
  }
  const resume = /^listing-queue\/([a-f0-9]{32,64})\/resume$/.exec(p)
  if (resume) {
    try {
      return NextResponse.json(await resumeListingImport(partnerId, resume[1]))
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e))
    }
  }
  const stop = /^listing-queue\/([a-f0-9]{32,64})\/stop$/.exec(p)
  if (stop) {
    try {
      return NextResponse.json(await stopListingImport(partnerId, stop[1]))
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e))
    }
  }

  const publish = /^drafts\/([0-9a-f-]{36})\/publish$/i.exec(p)
  if (publish) {
    try {
      return NextResponse.json(await publishListingImportDraft({ partnerId, draftId: publish[1] }))
    } catch (e) {
      const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status) : 400
      return jsonError(e instanceof Error ? e.message : String(e), Number.isFinite(status) ? status : 400)
    }
  }

  if (p === 'export-listing-link-template.xlsx') {
    const body = (await req.json().catch(() => ({}))) as {
      rows?: Array<{
        product_id?: string
        url?: string
        shop_name_chinese?: string
        china_price?: number | null
        chinese_name?: string
      }>
    }
    const rows = Array.isArray(body.rows) ? body.rows : []
    if (!rows.length) return jsonError('Chưa chọn dòng nào để xuất.')
    const buf = listingLinkTemplateXlsxBuffer(rows)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="listing_link_selected_${rows.length}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return jsonError('Not found', 404)
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return POST(req, ctx)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)
  const del = /^listing-queue\/([a-f0-9]{32,64})$/.exec(p)
  if (del) {
    try {
      return NextResponse.json(await deleteListingImportQueue(partnerId, del[1]))
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : String(e))
    }
  }
  if (p === 'settings/cookie') {
    const saved = await upsertListingImportSettingsFromPg({
      partnerId,
      cookieJson: [],
    })
    if (!saved) return jsonError('Không xóa được cookie.', 503)
    const cookies = await loadListingImportCookies(partnerId)
    return NextResponse.json({
      ...listingImportCookieSettingsMeta(cookies, 'Đã xóa cookie đã lưu trên workspace này (env/file vẫn còn nếu có).'),
      pandamall_username: saved.pandamall_username,
      has_pandamall_password: Boolean(saved.pandamall_password?.trim()),
    })
  }
  return jsonError('Not found', 404)
}
