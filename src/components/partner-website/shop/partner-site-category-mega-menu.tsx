'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import {
  compactPartnerCategorySizeSeoLabel,
  isPartnerKhoSaleNavNode,
  isPartnerShopMobileCategoryFace,
  PARTNER_CATEGORY_FINE_HOVER_MQ,
  PARTNER_CATEGORY_MEGA_CLOSE_MS,
  PARTNER_MOBILE_CATEGORY_FACE_MQ,
  partnerCategoryNavAllLabel,
  partnerCategoryNavHref,
  partnerKhoSaleNavBlurb,
  partnerKhoSaleNavLabel,
  partnerKhoSaleViewAllLabel,
  splitPartnerCategoryNavTree,
  takePartnerHorizontalNavTree,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteCategoryHubPath, partnerSiteKhoSalePath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export function usePartnerCategoryFineHover(): boolean {
  const [fineHover, setFineHover] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(PARTNER_CATEGORY_FINE_HOVER_MQ)
    const sync = () => setFineHover(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return fineHover
}

export function usePartnerShopMobileCategoryFace(previewDevice?: string | null): boolean {
  const [mobile, setMobile] = useState(previewDevice === 'mobile')
  useEffect(() => {
    const read = () => {
      let queryDevice = ''
      try {
        queryDevice = new URLSearchParams(location.search).get('pw-device') || ''
      } catch {
        queryDevice = ''
      }
      const html = document.documentElement
      setMobile(
        isPartnerShopMobileCategoryFace({
          editDevice: html.getAttribute('data-pw-edit-device'),
          sceneLock: html.getAttribute('data-pw-scene-lock'),
          queryDevice: queryDevice || previewDevice,
          viewportMobile: window.matchMedia(PARTNER_MOBILE_CATEGORY_FACE_MQ).matches,
        })
      )
    }
    read()
    const mq = window.matchMedia(PARTNER_MOBILE_CATEGORY_FACE_MQ)
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [previewDevice])
  useEffect(() => {
    document.documentElement.setAttribute('data-pw-cat-face', mobile ? 'mobile' : 'desktop')
  }, [mobile])
  return mobile
}

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
  tree: rawTree,
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
  const tree = useMemo(() => splitPartnerCategoryNavTree(rawTree, locale).menuTree, [rawTree, locale])
  const shopCopy = getPartnerSiteShopCopy(locale)
  const [openId, setOpenId] = useState<string>(tree[0]?.id ?? '__arrivals')
  const leaveTimer = useRef<number | null>(null)
  const fineHover = usePartnerCategoryFineHover()

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
  const hrefOf = (node: PartnerCategoryTreeNode) =>
    partnerCategoryNavHref(siteSlug, node, { customDomain })

  const selectL1 = (id: string, hasChildren: boolean, event?: { preventDefault: () => void }) => {
    if (!fineHover && hasChildren && openId !== id) {
      event?.preventDefault()
      setOpenId(id)
      return
    }
    onNavigate?.()
  }

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
            href={hrefOf(l1)}
            data-pw-el={PW_EL.navLink}
            data-pw-cat-l1={l1.id}
            className={openId === l1.id ? 'is-active' : undefined}
            onMouseEnter={() => setOpenId(l1.id)}
            onFocus={() => setOpenId(l1.id)}
            onClick={(event) =>
              selectL1(l1.id, !isPartnerKhoSaleNavNode(l1) && (l1.children?.length ?? 0) > 0, event)
            }
          >
            {isPartnerKhoSaleNavNode(l1)
              ? shopCopy.khoSaleNavLabel
              : resolvePartnerCategoryDisplayName(l1, locale)}
          </Link>
        ))}
      </div>
      <div className="pw-cat-mega-l23">
        {openId === '__arrivals' || !openCategory ? (
          <p className="pw-cat-mega-hint">{hoverHint}</p>
        ) : isPartnerKhoSaleNavNode(openCategory) ? (
          <div className="pw-cat-mega-kho" data-pw-kho-sale="1">
            <p className="pw-cat-mega-kho-title">{shopCopy.khoSaleNavLabel || partnerKhoSaleNavLabel(locale)}</p>
            <p className="pw-cat-mega-kho-blurb">{shopCopy.khoSaleNavBlurb || partnerKhoSaleNavBlurb(locale)}</p>
            <Link
              href={partnerSiteKhoSalePath(siteSlug, { customDomain })}
              className="pw-cat-mega-kho-more"
              data-pw-el={PW_EL.navLink}
              onClick={onNavigate}
            >
              {shopCopy.khoSaleViewAll || partnerKhoSaleViewAllLabel(locale)}
            </Link>
          </div>
        ) : (openCategory.children?.length ?? 0) === 0 ? (
          <p className="pw-cat-mega-hint">{hoverHint}</p>
        ) : (
          <div className="pw-cat-mega-l2-grid">
            {openCategory.children.map((l2) => (
              <div key={l2.id} className="pw-cat-mega-l2-col">
                <Link
                  href={hrefOf(l2)}
                  data-pw-el={PW_EL.navLink}
                  className="pw-cat-mega-l2"
                  onClick={onNavigate}
                >
                  {resolvePartnerCategoryDisplayName(l2, locale)}
                </Link>
                {(l2.children ?? []).map((l3) => (
                  <Link
                    key={l3.id}
                    href={hrefOf(l3)}
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

export function PartnerSiteCategorySeoRow(props: {
  nodes: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  customDomain?: boolean
  ariaLabel: string
}) {
  if (!props.nodes.length) return null
  return (
    <nav className="pw-seo-row" data-pw-seo-row="1" aria-label={props.ariaLabel}>
      {props.nodes.map((node) => (
        <Link
          key={node.id}
          href={partnerCategoryNavHref(props.siteSlug, node, { customDomain: props.customDomain })}
          data-pw-el={PW_EL.navLink}
        >
          {compactPartnerCategorySizeSeoLabel(resolvePartnerCategoryDisplayName(node, props.locale))}
        </Link>
      ))}
    </nav>
  )
}

export function PartnerSiteCategoryNavPills(props: {
  tree: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  productsHref: string
  saleHref: string
  newArrivalsLabel: string
  saleLabel: string
  expandLabel: string
  collapseLabel: string
  customDomain?: boolean
}) {
  const tree = useMemo(
    () => splitPartnerCategoryNavTree(props.tree, props.locale).menuTree,
    [props.tree, props.locale]
  )
  const pills = useMemo(() => takePartnerHorizontalNavTree(tree), [tree])
  const [openId, setOpenId] = useState<string | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const fineHover = usePartnerCategoryFineHover()
  const hrefOf = (node: PartnerCategoryTreeNode) =>
    partnerCategoryNavHref(props.siteSlug, node, { customDomain: props.customDomain })

  const cancelLeave = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }

  useEffect(() => () => cancelLeave(), [])

  const openCat = tree.find((n) => n.id === openId) ?? null

  return (
    <div
      className="pw-nav-pills-host"
      onMouseEnter={cancelLeave}
      onMouseLeave={() => {
        if (!fineHover) return
        cancelLeave()
        leaveTimer.current = window.setTimeout(() => setOpenId(null), PARTNER_CATEGORY_MEGA_CLOSE_MS)
      }}
    >
      <div className="pw-nav-row-scroll">
      <Link href={props.productsHref} data-pw-el={PW_EL.navLink}>
        {props.newArrivalsLabel}
      </Link>
      {pills.map((l1) => {
        const kids = l1.children ?? []
        const open = openId === l1.id
        return (
          <span
            key={l1.id}
            className={open ? 'pw-nav-pill is-open' : 'pw-nav-pill'}
            data-pw-nav-l1={l1.id}
            onMouseEnter={() => {
              if (!fineHover || !kids.length) return
              cancelLeave()
              setOpenId(l1.id)
            }}
          >
            <Link href={hrefOf(l1)} data-pw-el={PW_EL.navLink}>
              {isPartnerKhoSaleNavNode(l1)
                ? getPartnerSiteShopCopy(props.locale).khoSaleNavLabel
                : resolvePartnerCategoryDisplayName(l1, props.locale)}
            </Link>
            {kids.length ? (
              <button
                type="button"
                className="pw-nav-chevron"
                data-pw-nav-chevron=""
                aria-expanded={open}
                aria-label={open ? props.collapseLabel : props.expandLabel}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpenId(open ? null : l1.id)
                }}
              >
                ▾
              </button>
            ) : null}
          </span>
        )
      })}
      {tree.length > pills.length ? (
        <Link
          href={partnerSiteCategoryHubPath(props.siteSlug, { customDomain: props.customDomain })}
          data-pw-el={PW_EL.navLink}
          data-pw-nav-all="1"
        >
          {partnerCategoryNavAllLabel(props.locale)}
        </Link>
      ) : null}
      <Link href={props.saleHref} className="is-sale" data-pw-el={PW_EL.navLink}>
        {props.saleLabel}
      </Link>
      </div>
      {openCat && (openCat.children?.length ?? 0) > 0 ? (
        <div className="pw-nav-flyout-bar">
          {openCat.children.map((l2) => (
            <div key={l2.id} className="pw-cat-mega-l2-col">
              <Link href={hrefOf(l2)} data-pw-el={PW_EL.navLink} className="pw-cat-mega-l2">
                {resolvePartnerCategoryDisplayName(l2, props.locale)}
              </Link>
              {(l2.children ?? []).map((l3) => (
                <Link key={l3.id} href={hrefOf(l3)} data-pw-el={PW_EL.navLink} className="pw-cat-mega-l3">
                  {resolvePartnerCategoryDisplayName(l3, props.locale)}
                </Link>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AccChevron() {
  return (
    <svg className="pw-cat-acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function PartnerSiteCategoryMobileAccordion({
  tree: rawTree,
  siteSlug,
  locale,
  productsHref,
  saleHref,
  newArrivalsLabel,
  saleLabel,
  customDomain,
  onNavigate,
  onClose,
}: Props & { onClose?: () => void }) {
  const tree = useMemo(() => splitPartnerCategoryNavTree(rawTree, locale).menuTree, [rawTree, locale])
  const shopCopy = getPartnerSiteShopCopy(locale)
  const [openL1, setOpenL1] = useState<Set<string>>(() => new Set())
  const [openL2, setOpenL2] = useState<Set<string>>(() => new Set())
  const hrefOf = (node: PartnerCategoryTreeNode) =>
    partnerCategoryNavHref(siteSlug, node, { customDomain })

  const toggleL1 = (id: string) => {
    setOpenL1((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleL2 = (id: string) => {
    setOpenL2((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="pw-cat-acc" data-pw-cat-acc="1">
      <div className="pw-cat-acc-bar">
        <span className="pw-cat-acc-title">{shopCopy.categoryHubTitle}</span>
        <button type="button" className="pw-cat-acc-close" data-pw-cat-acc-close onClick={onClose}>
          <svg className="pw-cat-acc-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>{shopCopy.cartAddedClose}</span>
        </button>
      </div>
      <nav className="pw-cat-acc-list" aria-label={shopCopy.categoryHubTitle}>
        <div className="pw-cat-acc-item">
          <div className="pw-cat-acc-l1-row">
            <Link href={productsHref} className="pw-cat-acc-l1-link" data-pw-el={PW_EL.navLink} onClick={onNavigate}>
              {newArrivalsLabel}
            </Link>
          </div>
        </div>
        {tree.map((l1) => {
          const kids = isPartnerKhoSaleNavNode(l1) ? [] : l1.children ?? []
          const l1Open = openL1.has(l1.id)
          return (
            <div key={l1.id} className={l1Open ? 'pw-cat-acc-item is-open' : 'pw-cat-acc-item'} data-pw-cat-acc-l1={l1.id}>
              <div className="pw-cat-acc-l1-row">
                <Link href={hrefOf(l1)} className="pw-cat-acc-l1-link" data-pw-el={PW_EL.navLink} onClick={onNavigate}>
                  {isPartnerKhoSaleNavNode(l1)
                    ? shopCopy.khoSaleNavLabel
                    : resolvePartnerCategoryDisplayName(l1, locale)}
                </Link>
                {kids.length ? (
                  <button
                    type="button"
                    className="pw-cat-acc-toggle"
                    data-pw-cat-acc-toggle="l1"
                    aria-expanded={l1Open}
                    aria-label={l1Open ? shopCopy.categoryCollapse : shopCopy.categoryExpand}
                    onClick={() => toggleL1(l1.id)}
                  >
                    <AccChevron />
                  </button>
                ) : null}
              </div>
              {kids.length && l1Open ? (
                <div className="pw-cat-acc-l2-grid">
                  {kids.map((l2) => {
                    const l3 = l2.children ?? []
                    const l2Open = openL2.has(l2.id)
                    return (
                      <div
                        key={l2.id}
                        className={l2Open ? 'pw-cat-acc-l2 is-open' : 'pw-cat-acc-l2'}
                        data-pw-cat-acc-l2={l2.id}
                      >
                        <div className="pw-cat-acc-l2-row">
                          <Link href={hrefOf(l2)} className="pw-cat-acc-l2-link" data-pw-el={PW_EL.navLink} onClick={onNavigate}>
                            {resolvePartnerCategoryDisplayName(l2, locale)}
                          </Link>
                          {l3.length ? (
                            <button
                              type="button"
                              className="pw-cat-acc-toggle"
                              data-pw-cat-acc-toggle="l2"
                              aria-expanded={l2Open}
                              aria-label={l2Open ? shopCopy.categoryCollapse : shopCopy.categoryExpand}
                              onClick={() => toggleL2(l2.id)}
                            >
                              <AccChevron />
                            </button>
                          ) : null}
                        </div>
                        {l3.length && l2Open ? (
                          <div className="pw-cat-acc-l3-list">
                            {l3.map((g) => (
                              <Link
                                key={g.id}
                                href={hrefOf(g)}
                                className="pw-cat-acc-l3"
                                data-pw-el={PW_EL.navLink}
                                onClick={onNavigate}
                              >
                                {resolvePartnerCategoryDisplayName(g, locale)}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
      <Link href={saleHref} className="pw-cat-acc-sale is-sale" data-pw-el={PW_EL.navLink} onClick={onNavigate}>
        {saleLabel}
      </Link>
    </div>
  )
}
