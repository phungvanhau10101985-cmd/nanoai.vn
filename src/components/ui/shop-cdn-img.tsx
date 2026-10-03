'use client'

import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { nextShopImageRetrySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import { guestChatSameOriginImageSrc } from '@/lib/messaging/guest-chat-image-src'

type ShopCdnImgProps = ImgHTMLAttributes<HTMLImageElement> & { src: string }

/**
 * Ảnh shop / chat: CDN trực tiếp (5G, LCP). WiFi chặn `*.b-cdn.net` thì một lần
 * cùng origin — ảnh chat Bunny qua `/api/messaging/chat-image`, còn lại `/api/fetch-image`.
 */
export function ShopCdnImg({ src, onError, ...rest }: ShopCdnImgProps) {
  const [current, setCurrent] = useState(src)
  useEffect(() => {
    setCurrent(src)
  }, [src])
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={current}
      data-pw-img-react="1"
      onError={(ev) => {
        onError?.(ev)
        const cur = ev.currentTarget.currentSrc || ev.currentTarget.getAttribute('src') || current
        const same = guestChatSameOriginImageSrc(cur) || guestChatSameOriginImageSrc(src)
        if (same && same !== current) {
          setCurrent(same)
          return
        }
        const retry = nextShopImageRetrySrc(cur || current)
        if (retry && retry !== current && retry !== cur) setCurrent(retry)
      }}
    />
  )
}
