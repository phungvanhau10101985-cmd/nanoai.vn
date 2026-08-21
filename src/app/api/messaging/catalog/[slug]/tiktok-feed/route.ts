import { NextRequest } from 'next/server'
import { buildTiktokCatalogFeedCsv } from '@/lib/messaging/tiktok-catalog-feed'
import {
  catalogFeedBuildArgs,
  catalogFeedFileResponse,
  loadPartnerCatalogFeedContext,
} from '@/lib/messaging/partner-catalog-feed-http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET — CSV feed cho TikTok Ads catalog.
 * Query: `key` = `embed_key` của shop (giữ bí mật).
 *
 * Trong TikTok Ads Manager: Assets → Catalog → Data source → Scheduled feed → dán URL này.
 * Cột `sku_id` khớp remarketing_id / inventory.id (cùng feed Facebook / Google).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const loaded = await loadPartnerCatalogFeedContext(request, slug)
  if (loaded instanceof Response) return loaded

  const buf = buildTiktokCatalogFeedCsv(loaded.rows, catalogFeedBuildArgs(loaded))

  return catalogFeedFileResponse(buf, 'text/csv; charset=utf-8', 'tiktok-catalog.csv')
}
