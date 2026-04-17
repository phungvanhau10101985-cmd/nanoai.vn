import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { buildFacebookCatalogFeedCsv } from '@/lib/messaging/facebook-catalog-feed'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { listPartnerInventoryRows } from '@/lib/messaging/partner-inventory-upsert-batch'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function secureTokenEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

/**
 * GET — CSV feed cho Meta Commerce / Facebook danh mục sản phẩm.
 * Query: `key` = `embed_key` của shop (Cài đặt messaging — không đăng lộ công khai).
 *
 * Trong Commerce Manager: Nguồn dữ liệu → URL hoặc Google Trang tính → dán URL này.
 * Cột `link` trong CSV = trang tư vấn NanoAI (`/messaging/p/.../tu-van/...`), không dùng link web shop.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (isReservedMessagingGuestSlug(slug)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }

  const partner = await resolveActiveMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const key = url.searchParams.get('key')?.trim() ?? ''
  const embed = (partner.embed_key ?? '').trim()
  if (!embed || !key || !secureTokenEqual(key, embed)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const listed = await listPartnerInventoryRows(partner.id)
  if (!listed.ok) {
    return NextResponse.json({ error: listed.error }, { status: 500 })
  }

  const origin = getPublicAppUrlForServer(request)
  const brand = (partner.display_name ?? '').trim() || 'Shop'
  const buf = buildFacebookCatalogFeedCsv(listed.rows, { origin, slug, brand })

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, max-age=120',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
