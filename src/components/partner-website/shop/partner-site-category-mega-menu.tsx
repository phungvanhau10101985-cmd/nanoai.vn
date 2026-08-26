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
  PARTNER_CATEGORY_FINE_HOVER_MQ,
  PARTNER_CATEGORY_MEGA_CLOSE_MS,
  splitPartnerCategoryNavTree,
} from '@/lib/partner-website/shop/partner-site-category-mega-menu'
import { partnerSiteCategoryPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
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
  const tree = useMemo(() => splitPartnerCategoryNavTree(rawTree).menuTree, [rawTree])
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
  const hrefOf = (path: string) => partnerSiteCategoryPath(siteSlug, path, { customDomain })

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
            href={hrefOf(l1.path)}
            data-pw-el={PW_EL.navLink}
            data-pw-cat-l1={l1.id}
            className={openId === l1.id ? 'is-active' : undefined}
            onMouseEnter={() => setOpenId(l1.id)}
            onFocus={() => setOpenId(l1.id)}
            onClick={(event) => selectL1(l1.id, (l1.children?.length ?? 0) > 0, event)}
          >
            {resolvePartnerCategoryDisplayName(l1, locale)}
          </Link>
        ))}
      </div>
      <div className="pw-cat-mega-l23">
        {openId === '__arrivals' || !openCategory ? (
          <p className="pw-cat-mega-hint">{hoverHint}</p>
        ) : (openCategory.children?.length ?? 0) === 0 ? (
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
                {(l2.children ?? []).map((l3) => (
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
          href={partnerSiteCategoryPath(props.siteSlug, node.path, { customDomain: props.customDomain })}
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
  const tree = useMemo(() => splitPartnerCategoryNavTree(props.tree).menuTree, [props.tree])
  const [openId, setOpenId] = useState<string | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const fineHover = usePartnerCategoryFineHover()
  const hrefOf = (path: string) =>
    partnerSiteCategoryPath(props.siteSlug, path, { customDomain: props.customDomain })

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
      {tree.map((l1) => {
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
            <Link href={hrefOf(l1.path)} data-pw-el={PW_EL.navLink}>
              {resolvePartnerCategoryDisplayName(l1, props.locale)}
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
      <Link href={props.saleHref} className="is-sale" data-pw-el={PW_EL.navLink}>
        {props.saleLabel}
      </Link>
      </div>
      {openCat && (openCat.children?.length ?? 0) > 0 ? (
        <div className="pw-nav-flyout-bar">
          {openCat.children.map((l2) => (
            <div key={l2.id} className="pw-cat-mega-l2-col">
              <Link href={hrefOf(l2.path)} data-pw-el={PW_EL.navLink} className="pw-cat-mega-l2">
                {resolvePartnerCategoryDisplayName(l2, props.locale)}
              </Link>
              {(l2.children ?? []).map((l3) => (
                <Link key={l3.id} href={hrefOf(l3.path)} data-pw-el={PW_EL.navLink} className="pw-cat-mega-l3">
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
