'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteContactChannelsHasAny,
  partnerSiteTelHref,
  type PartnerSiteContactChannels,
} from '@/lib/partner-website/shop/partner-site-contact-channels'

type Props = {
  siteSlug: string
  locale: WebLocale
  /** Offset above NanoAI FAB / floating CTA stack. */
  hasFloatingCta?: boolean
}

export function PartnerSiteContactChannelsFab({ siteSlug, locale, hasFloatingCta }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const [channels, setChannels] = useState<PartnerSiteContactChannels | null>(null)
  const [hideChromeDupes, setHideChromeDupes] = useState({ zalo: false, facebook: false })

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/site/${encodeURIComponent(siteSlug)}/contact-channels`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { channels?: PartnerSiteContactChannels }) => {
        if (!cancelled && j.channels) setChannels(j.channels)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [siteSlug])

  useEffect(() => {
    setHideChromeDupes({
      zalo: Boolean(document.querySelector('[data-pw-chrome-btn="chat-zalo"]')),
      facebook: Boolean(document.querySelector('[data-pw-chrome-btn="chat-facebook"]')),
    })
  }, [channels])

  if (!partnerSiteContactChannelsHasAny(channels) || !channels) return null

  const items: Array<{ key: string; href: string; label: string; className: string }> = []
  if (channels.phone) {
    items.push({
      key: 'phone',
      href: partnerSiteTelHref(channels.phone),
      label: t.contactChannelPhone,
      className: 'bg-emerald-600',
    })
  }
  if (channels.zaloUrl && !hideChromeDupes.zalo) {
    items.push({
      key: 'zalo',
      href: channels.zaloUrl,
      label: t.contactChannelZalo,
      className: 'bg-sky-500',
    })
  }
  if (channels.messengerUrl && !hideChromeDupes.facebook) {
    items.push({
      key: 'messenger',
      href: channels.messengerUrl,
      label: t.contactChannelMessenger,
      className: 'bg-blue-600',
    })
  }
  if (channels.instagramUrl) {
    items.push({
      key: 'instagram',
      href: channels.instagramUrl,
      label: t.contactChannelInstagram,
      className: 'bg-pink-600',
    })
  }

  // Stack above NanoAI (~bottom-4) and optional floating CTA.
  const bottomClass = hasFloatingCta
    ? 'bottom-[19.5rem] md:bottom-[9.5rem]'
    : 'bottom-[12.5rem] md:bottom-[5.5rem]'

  return (
    <div
      className={`fixed right-3 z-[2147482850] flex flex-col items-end gap-2 md:right-4 ${bottomClass}`}
      aria-label={t.contactChannelsAria}
    >
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.key === 'phone' ? undefined : '_blank'}
          rel={item.key === 'phone' ? undefined : 'noopener noreferrer'}
          className={`${item.className} flex h-11 min-w-[11rem] max-w-[12rem] items-center justify-center rounded-full px-3 text-sm font-semibold text-white shadow-lg`}
        >
          {item.label}
        </a>
      ))}
    </div>
  )
}
