'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import { PARTNER_CATEGORY_MEGA_CLOSE_MS } from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { partnerSiteCategoryPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  tree: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  productsHref: string
  saleHref: string
  newArrivalsLabel: string
  saleLabel: string
  hoverHint: string
  customDomain?: boolean
  onNavigate?: () => void
}

export function PartnerSiteCategoryMegaMenu({
  tree,
  siteSlug,
  locale,
  productsHref,
  saleHref,
  newArrivalsLabel,
  saleLabel,
  hoverHint,
  customDomain,
  onNavigate,
}: Props) {
  const [openId, setOpenId] = useState<string>(tree[0]?.id ?? '__arrivals')
  const leaveTimer = useRef<number | null>(null)

  useEffect(() => {
    setOpenId(tree[0]?.id ?? '__arrivals')
  }, [tree])

  const cancelLeave = useCallback(() => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }, [])

  const scheduleLeave = useCallback(() => {
    cancelLeave()
    leaveTimer.current = window.setTimeout(() => {
      setOpenId(tree[0]?.id ?? '__arrivals')
    }, PARTNER_CATEGORY_MEGA_CLOSE_MS)
  }, [cancelLeave, tree])

  useEffect(() => () => cancelLeave(), [cancelLeave])

  const openCategory = tree.find((c) => c.id === openId) ?? null
  const hrefOf = (path: string) => partnerSiteCategoryPath(siteSlug, path, { customDomain })

  return (
    <div className="pw-cat-mega-root" onMouseEnter={cancelLeave} onMouseLeave={scheduleLeave}>
    <div className="pw-cat-mega-cols" data-pw-cat-mega="1">
      <div className="pw-cat-mega-l1">
        <Link
          href={productsHref}
          data-pw-el={PW_EL.navLink}
          data-pw-cat-l1="__arrivals"
          className={openId === '__arrivals' ? 'is-active' : undefined}
          onMouseEnter={() => setOpenId('__arrivals')}
          onClick={onNavigate}
        >
          {newArrivalsLabel}
        </Link>
        {tree.map((l1) => (
          <Link
            key={l1.id}
            href={hrefOf(l1.path)}
            data-pw-el={PW_EL.navLink}
            data-pw-cat-l1={l1.id}
            className={openId === l1.id ? 'is-active' : undefined}
            onMouseEnter={() => setOpenId(l1.id)}
            onFocus={() => setOpenId(l1.id)}
            onClick={onNavigate}
          >
            {resolvePartnerCategoryDisplayName(l1, locale)}
          </Link>
        ))}
      </div>
      <div className="pw-cat-mega-l23">
        {openId === '__arrivals' || !openCategory ? (
          <p className="pw-cat-mega-hint">{hoverHint}</p>
        ) : openCategory.children.length === 0 ? (
          <p className="pw-cat-mega-hint">{hoverHint}</p>
        ) : (
          <div className="pw-cat-mega-l2-grid">
            {openCategory.children.map((l2) => (
              <div key={l2.id} className="pw-cat-mega-l2-col">
                <Link
                  href={hrefOf(l2.path)}
                  data-pw-el={PW_EL.navLink}
                  className="pw-cat-mega-l2"
                  onClick={onNavigate}
                >
                  {resolvePartnerCategoryDisplayName(l2, locale)}
                </Link>
                {l2.children.map((l3) => (
                  <Link
                    key={l3.id}
                    href={hrefOf(l3.path)}
                    data-pw-el={PW_EL.navLink}
                    className="pw-cat-mega-l3"
                    onClick={onNavigate}
                  >
                    {resolvePartnerCategoryDisplayName(l3, locale)}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
      <Link href={saleHref} className="is-sale pw-nav-sale pw-cat-mega-sale" data-pw-el={PW_EL.navLink} onClick={onNavigate}>
        {saleLabel}
      </Link>
    </div>
  )
}
