import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteCategoryPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

/** Khớp 188 Navigation: rời panel → đóng sau 150ms. */
export const PARTNER_CATEGORY_MEGA_CLOSE_MS = 150

export type PartnerCategoryMegaMenuCopy = {
  newArrivals: string
  sale: string
  hoverHint: string
  empty: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPartnerSiteCategoryMegaMenuHtml(input: {
  tree: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  productsHref: string
  saleHref: string
  copy: PartnerCategoryMegaMenuCopy
  customDomain?: boolean
}): string {
  const { tree, siteSlug, locale, productsHref, saleHref, copy } = input
  const firstId = tree[0]?.id ?? ''
  const l1Bits: string[] = [
    `<a href="${escapeHtml(productsHref)}" data-pw-el="nav-link" data-pw-cat-l1="__arrivals">${escapeHtml(copy.newArrivals)}</a>`,
  ]
  const paneBits: string[] = [
    `<div data-pw-cat-pane="__arrivals" hidden><p class="pw-cat-mega-hint">${escapeHtml(copy.hoverHint)}</p></div>`,
  ]

  for (const l1 of tree) {
    const label = resolvePartnerCategoryDisplayName(l1, locale)
    if (!label) continue
    const href = partnerSiteCategoryPath(siteSlug, l1.path, { customDomain: input.customDomain })
    const active = l1.id === firstId ? ' is-active' : ''
    l1Bits.push(
      `<a href="${escapeHtml(href)}" data-pw-el="nav-link" data-pw-cat-l1="${escapeHtml(l1.id)}" class="${active.trim()}">${escapeHtml(label)}</a>`
    )
    const l2 = l1.children ?? []
    let inner = ''
    if (l2.length === 0) {
      inner = `<p class="pw-cat-mega-hint">${escapeHtml(copy.hoverHint)}</p>`
    } else {
      inner = `<div class="pw-cat-mega-l2-grid">${l2
        .map((child) => {
          const name2 = resolvePartnerCategoryDisplayName(child, locale)
          const href2 = partnerSiteCategoryPath(siteSlug, child.path, { customDomain: input.customDomain })
          const l3 = (child.children ?? [])
            .map((g) => {
              const name3 = resolvePartnerCategoryDisplayName(g, locale)
              const href3 = partnerSiteCategoryPath(siteSlug, g.path, { customDomain: input.customDomain })
              return `<a href="${escapeHtml(href3)}" data-pw-el="nav-link" class="pw-cat-mega-l3">${escapeHtml(name3)}</a>`
            })
            .join('')
          return `<div class="pw-cat-mega-l2-col"><a href="${escapeHtml(href2)}" data-pw-el="nav-link" class="pw-cat-mega-l2">${escapeHtml(name2)}</a>${l3}</div>`
        })
        .join('')}</div>`
    }
    const hidden = l1.id === firstId ? '' : ' hidden'
    paneBits.push(`<div data-pw-cat-pane="${escapeHtml(l1.id)}"${hidden}>${inner}</div>`)
  }

  return `<div class="pw-cat-mega-cols" data-pw-cat-mega="1">
<div class="pw-cat-mega-l1">${l1Bits.join('')}</div>
<div class="pw-cat-mega-l23">${paneBits.join('')}</div>
</div>
<a href="${escapeHtml(saleHref)}" class="is-sale pw-nav-sale pw-cat-mega-sale" data-pw-el="nav-link">${escapeHtml(copy.sale)}</a>`
}
