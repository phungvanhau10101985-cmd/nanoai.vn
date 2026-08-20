import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { rewritePartnerInfoPageWithAi } from '@/lib/partner-website/pages/partner-info-page-ai-rewrite'
import { getPartnerWebsitePageDef, normalizePartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    pageKey?: string
    cmsSlug?: string
    currentTitle?: string
    currentContent?: string
    extraPrompt?: string
    locale?: WebLocale
  }
  const content = String(body.currentContent || '').trim()
  const extra = String(body.extraPrompt || '').trim()
  const currentTitle = String(body.currentTitle || '').trim()
  // Ghi chú SEO là tùy chọn — đủ tiêu đề hoặc nội dung trang (hoặc pageKey) là AI tự viết lại + tối ưu từ khóa.
  if (content.length < 2 && extra.length < 2 && currentTitle.length < 2 && !String(body.pageKey || body.cmsSlug || '').trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const website = await fetchPartnerWebsiteByPartnerIdPg(pid)
  const pageKey = body.pageKey ? normalizePartnerWebsitePageKey(body.pageKey) : 'about'
  const def = getPartnerWebsitePageDef(pageKey)
  const rewritten = await rewritePartnerInfoPageWithAi({
    pageTitle: def?.htmlPath || pageKey,
    pageLabel: body.cmsSlug?.trim() || pageKey,
    pageKey,
    shopName: website?.title || 'Shop',
    locale: normalizeWebLocale(body.locale || website?.locale || 'vi'),
    currentTitle,
    currentContent: content,
    extraPrompt: extra,
  })
  if (!rewritten) return NextResponse.json({ error: 'AI could not rewrite' }, { status: 502 })
  return NextResponse.json({ success: true, ...rewritten })
}
