import { cache } from 'react'
import { cookies } from 'next/headers'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { resolveCurrentPartnerMarketingBanners } from '@/lib/partner-website/promotions/partner-marketing-banner-current'
import type { PartnerMarketingBannerPublicItem } from '@/lib/partner-website/promotions/partner-marketing-banner'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

async function peekSiteVisitorShopAccount(): Promise<{
  linkedUserId: string | null
  guestAccountId: string | null
}> {
  const user = await getEmailSessionUser()
  const jar = cookies()
  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = jar.get(name)?.value?.trim()
      if (value) return value
    }
    return ''
  }
  const guestAccount = pick(
    MESSAGING_GUEST_ACCOUNT_COOKIE,
    MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
    MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE
  )
  return {
    linkedUserId: user?.id?.trim() || null,
    guestAccountId: guestAccount || null,
  }
}

async function loadSiteLiveMarketingBannersUncached(
  siteSlug: string
): Promise<PartnerMarketingBannerPublicItem[] | null> {
  const slug = siteSlug.trim().toLowerCase()
  if (!slug) return null
  try {
    const shop = await loadPartnerSiteShopContext(slug)
    if (!shop) return null
    const account = await peekSiteVisitorShopAccount()
    return await resolveCurrentPartnerMarketingBanners({
      partnerId: shop.partnerId,
      siteSlug: shop.site.siteSlug,
      locale: shop.site.locale,
      linkedUserId: account.linkedUserId,
      guestAccountId: account.guestAccountId,
    })
  } catch {
    return null
  }
}

/** Một lần / request — first paint HTML, không đợi fetch client. */
export const loadSiteLiveMarketingBanners = cache(loadSiteLiveMarketingBannersUncached)
