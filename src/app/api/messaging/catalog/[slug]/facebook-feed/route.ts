import { NextRequest } from 'next/server'
import { buildFacebookCatalogFeedCsv } from '@/lib/messaging/facebook-catalog-feed'
import {
  catalogFeedBuildArgs,
  catalogFeedFileResponse,
  loadPartnerCatalogFeedContext,
} from '@/lib/messaging/partner-catalog-feed-http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET — CSV feed cho Meta Commerce / Facebook danh mục sản phẩm.
 * Query: `key` = `embed_key` của shop (giữ bí mật).
 *
 * Trong Commerce Manager: Nguồn dữ liệu → URL hoặc Google Trang tính → dán URL này.
 * Cột `link` ưu tiên trang sản phẩm web shop đã publish (cùng Google / TikTok).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const loaded = await loadPartnerCatalogFeedContext(request, slug)
  if (loaded instanceof Response) return loaded

  const buf = buildFacebookCatalogFeedCsv(loaded.rows, catalogFeedBuildArgs(loaded))
  return catalogFeedFileResponse(buf, 'text/csv; charset=utf-8', 'facebook-catalog.csv')
}
