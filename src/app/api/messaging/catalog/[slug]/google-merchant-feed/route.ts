import { NextRequest } from 'next/server'
import { buildGoogleMerchantCatalogFeedTsv } from '@/lib/messaging/google-merchant-catalog-feed'
import {
  catalogFeedBuildArgs,
  catalogFeedFileResponse,
  loadPartnerCatalogFeedContext,
} from '@/lib/messaging/partner-catalog-feed-http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET — TSV feed cho Google Merchant Center.
 * Query: `key` = `embed_key` của shop (giữ bí mật).
 *
 * Trong Merchant Center: Products → Feeds → Add feed → Scheduled fetch → dán URL này.
 * Cột `id` khớp remarketing_id / inventory.id (cùng feed Facebook).
 * Cột `link` ưu tiên trang sản phẩm web shop đã publish.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const loaded = await loadPartnerCatalogFeedContext(request, slug)
  if (loaded instanceof Response) return loaded

  const buf = buildGoogleMerchantCatalogFeedTsv(loaded.rows, catalogFeedBuildArgs(loaded))

  return catalogFeedFileResponse(buf, 'text/tab-separated-values; charset=utf-8', 'google-merchant.tsv')
}
