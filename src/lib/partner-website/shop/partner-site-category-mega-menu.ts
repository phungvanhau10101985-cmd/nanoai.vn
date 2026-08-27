import {
  resolvePartnerCategoryDisplayName,
  slugifyPartnerCategoryName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoryPath,
  partnerSiteKhoSalePath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

/** Khớp 188 Navigation: rời panel → đóng sau 150ms. */
export const PARTNER_CATEGORY_MEGA_CLOSE_MS = 150

/** Desktop: hover mở danh mục. Mobile/touch không dùng hover. */
export const PARTNER_CATEGORY_FINE_HOVER_MQ = '(hover: hover) and (pointer: fine)'

/** Accordion 188 — chỉ máy mobile (stamp / `?pw-device=`). Tab hẹp không đổi desktop. */
export const PARTNER_MOBILE_CATEGORY_FACE_MQ = '(max-width:639px)'

export function isPartnerShopMobileCategoryFace(input: {
  editDevice?: string | null
  sceneLock?: string | null
  queryDevice?: string | null
  viewportMobile?: boolean
}): boolean {
  const stamped = String(input.editDevice || input.sceneLock || input.queryDevice || '')
    .trim()
    .toLowerCase()
  if (stamped === 'mobile') return true
  if (stamped === 'desktop' || stamped === 'laptop' || stamped === 'tablet') return false
  return Boolean(input.viewportMobile)
}

/** Mục synthetic «Sale kho» — giống 188 `KHO_SALE_MENU_SLUG`. */
export const PARTNER_KHO_SALE_NAV_ID = '__kho-sale'
export const PARTNER_KHO_SALE_SLUG = 'kho-sale'

const SIZE_SEO_NAME_RE = /ch[iỉ]\s*size/i
const SIZE_SEO_SLUG_RE = /(^|-)chi-size(-|$)/i
const SIZE_TOKEN_RE = /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d{1,3}(?:\.\d)?)$/i
const BARE_SIZE_L1_RE = /^(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d{1,2}(?:\.\d)?|\d{2,3})$/i
const SIZE_ONLY_PREFIX_RE = /^size\s+(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d+)\s*$/i
/** Nhóm kho 188: «nam G04», «nữ G05», «trung niên nam G04». */
const WAREHOUSE_GROUP_RE = /(?:^|[\s\-])(?:nam|n[uữ]|nu)\s*g\d{1,3}$/i
/** Mã dòng kho: G06NAM / G03NỮ. */
const WAREHOUSE_SKU_RE = /^g\d{1,3}(?:nam|n[uữ]|nu)$/i
const WAREHOUSE_SKU_IN_NAME_RE = /\bg\d{2}(?:nam|n[uữ]|nu)\b/i
const DIRTY_SIZE_PREFIX_RE = /^size\s+\S+\s+\S+/i

export function isPartnerKhoSaleNavNode(node: {
  id?: string | null
  name?: string | null
  slug?: string | null
}): boolean {
  const id = String(node.id || '')
  const slug = String(node.slug || '').trim().toLowerCase()
  const name = String(node.name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return (
    id === PARTNER_KHO_SALE_NAV_ID ||
    slug === PARTNER_KHO_SALE_SLUG ||
    slug === 'sale-kho' ||
    name === 'sale kho' ||
    name === 'kho sale'
  )
}

export function isPartnerCategorySizeSeoNode(node: { name?: string | null; slug?: string | null }): boolean {
  return SIZE_SEO_NAME_RE.test(String(node.name || '')) || SIZE_SEO_SLUG_RE.test(String(node.slug || ''))
}

function sizeSeoRest(name: string): string {
  const match = name.trim().match(/ch[iỉ]\s*size\s*[:\-]?\s*(.*)$/i)
  return (match?.[1] || '').trim()
}

/** «CHỈ SIZE 43» / «CHỈ SIZE S» — keyword SEO thật. Không phải «CHỈ SIZE M G06NAM». */
export function isPartnerCategoryCleanSizeSeoNode(node: { name?: string | null; slug?: string | null }): boolean {
  if (!isPartnerCategorySizeSeoNode(node)) return false
  return SIZE_TOKEN_RE.test(sizeSeoRest(String(node.name || '')))
}

export function isPartnerCategoryWarehouseGroupNode(node: { name?: string | null; slug?: string | null }): boolean {
  const name = String(node.name || '').trim()
  const compact = name.replace(/\s+/g, '')
  const slug = String(node.slug || '').trim().toLowerCase()
  if (WAREHOUSE_GROUP_RE.test(name) || WAREHOUSE_SKU_RE.test(compact)) return true
  if (/^(nam|nu)-g\d{1,3}$/i.test(slug) || /^g\d{1,3}(nam|nu)$/i.test(slug)) return true
  return false
}

export function isPartnerCategoryDirtySizeNavNode(node: { name?: string | null; slug?: string | null }): boolean {
  const name = String(node.name || '').trim()
  if (isPartnerCategorySizeSeoNode(node) && !isPartnerCategoryCleanSizeSeoNode(node)) return true
  if (DIRTY_SIZE_PREFIX_RE.test(name) || WAREHOUSE_SKU_IN_NAME_RE.test(name)) return true
  return false
}

/** Ẩn khỏi mega / pill — size SEO, nhóm kho, size trần. */
export function isPartnerCategoryNavJunkNode(node: { name?: string | null; slug?: string | null }): boolean {
  const name = String(node.name || '').trim()
  if (isPartnerCategorySizeSeoNode(node)) return true
  if (isPartnerCategoryWarehouseGroupNode(node) || isPartnerCategoryDirtySizeNavNode(node)) return true
  return BARE_SIZE_L1_RE.test(name) || SIZE_ONLY_PREFIX_RE.test(name)
}

function compareCategoryNavName(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { sensitivity: 'base' })
}

/** L1/L2/L3 ngành hàng — giữ sort_order import (188), tên chỉ khi hòa. */
function sortIndustryNavTree(nodes: PartnerCategoryTreeNode[]): PartnerCategoryTreeNode[] {
  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder || compareCategoryNavName(a.name, b.name))
    .map((node) => ({ ...node, children: sortIndustryNavTree(node.children ?? []) }))
}

/**
 * Không tạo node từ size/SKU sale kho khi import/sync — kể cả «CHỈ SIZE 43»
 * (188 ẩn Chỉ size khỏi L1; không biến size thành ngành hàng).
 */
export function shouldSkipPartnerCategoryImportName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  const node = { name: trimmed, slug: slugifyPartnerCategoryName(trimmed) }
  return isPartnerCategoryNavJunkNode(node)
}

/** «CHỈ SIZE 43» → «Size 43» trên hàng SEO một dòng. */
export function compactPartnerCategorySizeSeoLabel(name: string): string {
  const raw = name.trim()
  const match = raw.match(/ch[iỉ]\s*size\s*[:\-]?\s*(.*)$/i)
  const rest = (match?.[1] || raw).trim()
  return rest ? `Size ${rest}` : raw
}

export function partnerKhoSaleNavLabel(locale: WebLocale): string {
  if (locale === 'en') return 'Warehouse sale'
  if (locale === 'zh') return '仓库特卖'
  if (locale === 'ja') return '倉庫セール'
  if (locale === 'ko') return '창고 세일'
  return 'Sale kho'
}

export function partnerKhoSaleNavBlurb(locale: WebLocale): string {
  if (locale === 'en') return 'Returned and clearance stock — promotional prices, limited quantity.'
  if (locale === 'zh') return '退货与清仓库存 — 优惠价，数量有限。'
  if (locale === 'ja') return '返品・倉庫清算品 — 特価、数量限定。'
  if (locale === 'ko') return '반품·창고 정리 재고 — 특가, 수량 한정.'
  return 'Hàng hoàn và tồn thanh lý — giá ưu đãi, số lượng có hạn.'
}

export function partnerKhoSaleViewAllLabel(locale: WebLocale): string {
  if (locale === 'en') return 'View all →'
  if (locale === 'zh') return '查看全部 →'
  if (locale === 'ja') return 'すべて見る →'
  if (locale === 'ko') return '모두 보기 →'
  return 'Xem tất cả →'
}

/** Hàng pill ngang ~8 L1 như 188; đủ cây vẫn trong mega «Danh mục». */
export const PARTNER_HORIZONTAL_NAV_L1_LIMIT = 8

/** Khớp 188 Navigation `w-[min(720px,calc(100vw-1.5rem))]`. */
export const PARTNER_CATEGORY_MEGA_WIDTH_PX = 720

/** Khớp 188 `grid-cols-[220px_1fr]` — cột L1 cuộn, chữ được xuống dòng. */
export const PARTNER_CATEGORY_MEGA_L1_WIDTH_PX = 220

export function partnerCategoryNavAllLabel(locale: WebLocale): string {
  if (locale === 'en') return 'All'
  if (locale === 'zh') return '全部'
  if (locale === 'ja') return 'すべて'
  if (locale === 'ko') return '전체'
  return 'Tất cả'
}

export function takePartnerHorizontalNavTree(tree: PartnerCategoryTreeNode[]): PartnerCategoryTreeNode[] {
  const kho = tree.filter((node) => isPartnerKhoSaleNavNode(node))
  const industry = tree.filter((node) => !isPartnerKhoSaleNavNode(node))
  const room = Math.max(0, PARTNER_HORIZONTAL_NAV_L1_LIMIT - kho.length)
  return [...kho, ...industry.slice(0, room)]
}

/** Mega + flyout: không tràn, không đè chữ, L3 chữ thường. */
export const PARTNER_CATEGORY_MEGA_LAYOUT_CSS = `
html .pw-cat-panel.is-open.pw-cat-mega:not([data-pw-panel-fixed]),html .pw-shop-cat-panel.is-open.pw-cat-mega:not([data-pw-panel-fixed]),html [data-pw-cat-panel].is-open.pw-cat-mega:not([data-pw-panel-fixed]){
  left:0!important;right:auto!important;box-sizing:border-box;
  width:min(720px,calc(var(--pw-scene-w,100vw) - 24px));
  min-width:min(280px,calc(var(--pw-scene-w,100vw) - 24px));
  max-width:calc(var(--pw-scene-w,100vw) - 24px);overflow:hidden
}
html .pw-cat-panel.is-open.pw-cat-mega[data-pw-panel-fixed],html .pw-shop-cat-panel.is-open.pw-cat-mega[data-pw-panel-fixed],html [data-pw-cat-panel].is-open.pw-cat-mega[data-pw-panel-fixed]{
  box-sizing:border-box;
  width:min(720px,calc(var(--pw-scene-w,100vw) - 24px));
  min-width:min(280px,calc(var(--pw-scene-w,100vw) - 24px));
  max-width:calc(var(--pw-scene-w,100vw) - 24px);overflow:hidden
}
html .pw-cat-mega-root,html .pw-cat-mega-cols{
  display:grid;grid-template-columns:220px minmax(0,1fr);min-height:200px;min-width:0;width:100%;max-width:100%
}
html .pw-cat-mega-l1{min-width:220px;width:220px;max-width:220px;max-height:min(70vh,420px);overflow:auto}
html .pw-cat-mega-l23{min-width:0;max-height:min(70vh,420px);overflow-x:hidden;overflow-y:auto}
html .pw-cat-mega-l1 a,html .pw-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l1 a,html .pw-shop-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l1 a,html [data-pw-cat-panel].is-open.pw-cat-mega .pw-cat-mega-l1 a{
  display:block!important;white-space:normal!important;overflow-wrap:anywhere;line-height:1.35
}
html .pw-cat-mega-l2-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px 16px;min-width:0;align-items:start
}
html .pw-cat-mega-l2-col{min-width:0}
html .pw-cat-mega-l2,html .pw-nav-flyout-bar .pw-cat-mega-l2{
  display:block;white-space:normal!important;overflow-wrap:anywhere;text-transform:none!important;letter-spacing:0!important;font-weight:700
}
html .pw-cat-mega-l3,html .pw-nav-flyout-bar .pw-cat-mega-l3{
  display:block;white-space:normal!important;overflow-wrap:anywhere;text-transform:lowercase!important;letter-spacing:0!important;font-weight:500
}
html .pw-cat-mega-kho,html .pw-cat-mega-kho-blurb,html .pw-cat-mega-hint{white-space:normal!important;max-width:100%}
html .pw-nav-flyout-bar{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px 16px;
  left:0;right:0;width:100%;max-width:100%;box-sizing:border-box;
  overflow-x:hidden;overflow-y:auto;max-height:min(60vh,420px)
}
html .pw-nav-main .pw-nav-flyout-bar a,html .pw-shop-nav-row .pw-nav-flyout-bar a,
html .pw-cat-mega-l23 a,html .pw-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l2,
html .pw-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l3,html .pw-shop-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l2,
html .pw-shop-cat-panel.is-open.pw-cat-mega .pw-cat-mega-l3{
  white-space:normal!important
}
.pw-cat-acc{display:none}
html[data-pw-edit-device="desktop"] .pw-cat-acc,html[data-pw-edit-device="laptop"] .pw-cat-acc,html[data-pw-edit-device="tablet"] .pw-cat-acc,
html[data-pw-scene-lock="desktop"] .pw-cat-acc,html[data-pw-scene-lock="laptop"] .pw-cat-acc,html[data-pw-scene-lock="tablet"] .pw-cat-acc,
html[data-pw-cat-face="desktop"] .pw-cat-acc,html[data-pw-cat-face="laptop"] .pw-cat-acc,html[data-pw-cat-face="tablet"] .pw-cat-acc{display:none!important}
html[data-pw-edit-device="mobile"] .pw-cat-acc,html[data-pw-scene-lock="mobile"] .pw-cat-acc,html[data-pw-cat-face="mobile"] .pw-cat-acc,
.pw-shop-cat-panel>.pw-cat-acc{display:block}
html[data-pw-edit-device="mobile"] [data-pw-cat-mega],html[data-pw-scene-lock="mobile"] [data-pw-cat-mega],html[data-pw-cat-face="mobile"] [data-pw-cat-mega],
html[data-pw-edit-device="mobile"] .pw-cat-mega-sale,html[data-pw-scene-lock="mobile"] .pw-cat-mega-sale,html[data-pw-cat-face="mobile"] .pw-cat-mega-sale{display:none!important}
html[data-pw-edit-device="mobile"] .pw-cat-panel.is-open.pw-cat-mega,html[data-pw-scene-lock="mobile"] .pw-cat-panel.is-open.pw-cat-mega,html[data-pw-cat-face="mobile"] .pw-cat-panel.is-open.pw-cat-mega,
html[data-pw-edit-device="mobile"] .pw-shop-cat-panel.pw-cat-mega,html[data-pw-scene-lock="mobile"] .pw-shop-cat-panel.pw-cat-mega,html[data-pw-cat-face="mobile"] .pw-shop-cat-panel.pw-cat-mega,
html[data-pw-edit-device="mobile"] [data-pw-cat-panel].is-open.pw-cat-mega,html[data-pw-scene-lock="mobile"] [data-pw-cat-panel].is-open.pw-cat-mega,html[data-pw-cat-face="mobile"] [data-pw-cat-panel].is-open.pw-cat-mega{
  position:fixed!important;left:0!important;right:0!important;width:100%!important;min-width:0!important;max-width:100%!important;
  top:var(--pw-cat-sheet-top,56px);border-radius:0 0 12px 12px!important;max-height:70vh;overflow-x:hidden;overflow-y:auto;z-index:99999!important
}
.pw-cat-acc-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fff;border-bottom:1px solid var(--pw-border,#e5e7eb)}
.pw-cat-acc-title{font-size:14px;font-weight:700;color:var(--pw-text,#111827)}
.pw-cat-acc-close{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border:none;border-radius:10px;background:var(--pw-buy);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.pw-cat-acc-x{width:16px;height:16px}
.pw-cat-acc-item{border-bottom:1px solid var(--pw-border,#f3f4f6)}
.pw-cat-acc-l1-row,.pw-cat-acc-l2-row{display:flex;align-items:center;min-height:44px}
.pw-cat-acc-l1-link{flex:1;min-width:0;padding:12px 16px;text-transform:uppercase;letter-spacing:.02em;font-size:13px;font-weight:600;color:var(--pw-text,#111827);text-decoration:none}
.pw-cat-acc-l1-link:hover{color:var(--pw-primary)}
.pw-cat-acc-toggle{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:none;background:transparent;color:var(--pw-buy);cursor:pointer}
.pw-cat-acc-chevron{width:20px;height:20px;transition:transform .15s}
.pw-cat-acc-item.is-open>.pw-cat-acc-l1-row .pw-cat-acc-chevron,.pw-cat-acc-l2.is-open>.pw-cat-acc-l2-row .pw-cat-acc-chevron{transform:rotate(90deg)}
.pw-cat-acc-l2-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:var(--pw-surface,#f9fafb);border-top:1px solid var(--pw-border,#f3f4f6)}
.pw-cat-acc-l2{border:1px solid var(--pw-border,#e5e7eb);border-radius:10px;background:#fff;overflow:hidden;min-width:0}
.pw-cat-acc-l2-link{flex:1;min-width:0;padding:10px 12px;font-size:13px;font-weight:600;color:var(--pw-text,#111827);text-decoration:none;overflow-wrap:anywhere}
.pw-cat-acc-l2-link:hover{color:var(--pw-primary)}
.pw-cat-acc-l3-list{background:color-mix(in srgb,var(--pw-surface,#f3f4f6) 80%,#fff);border-top:1px solid var(--pw-border,#f3f4f6)}
.pw-cat-acc-l3{display:block;padding:8px 12px;font-size:12px;font-weight:500;color:var(--pw-muted,#6b7280);text-transform:lowercase!important;text-decoration:none;overflow-wrap:anywhere}
.pw-cat-acc-l3:hover{color:var(--pw-primary)}
.pw-cat-acc-sale{display:block;padding:12px 16px;font-weight:700;border-top:1px solid var(--pw-border,#e5e7eb)}
html .pw-cat-acc a,html .pw-cat-panel.is-open .pw-cat-acc a,html .pw-shop-cat-panel .pw-cat-acc a{white-space:normal!important}
.pw-cat-acc-backdrop{position:fixed;inset:0;z-index:99998;border:0;padding:0;margin:0;background:rgba(0,0,0,.4);cursor:pointer}
.pw-cat-acc-backdrop[hidden]{display:none!important}
@media (max-width:639px){
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-cat-acc{display:block!important}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-cat-mega],
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-cat-mega-sale{display:none!important}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-cat-panel.is-open.pw-cat-mega,
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-shop-cat-panel.pw-cat-mega,
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-cat-panel].is-open.pw-cat-mega{
    position:fixed!important;left:0!important;right:0!important;width:100%!important;min-width:0!important;max-width:100%!important;
    top:var(--pw-cat-sheet-top,56px);border-radius:0 0 12px 12px!important;max-height:70vh;overflow-x:hidden;overflow-y:auto;z-index:99999!important
  }
}
`

function emptyKhoSaleNavNode(locale: WebLocale, existing?: PartnerCategoryTreeNode): PartnerCategoryTreeNode {
  const name = existing?.name?.trim() || partnerKhoSaleNavLabel(locale)
  return {
    id: existing?.id || PARTNER_KHO_SALE_NAV_ID,
    partnerId: existing?.partnerId || '',
    parentId: null,
    name,
    nameI18n: existing?.nameI18n ?? {},
    slug: existing?.slug || PARTNER_KHO_SALE_SLUG,
    path: existing?.path || PARTNER_KHO_SALE_SLUG,
    depth: 0,
    sortOrder: existing?.sortOrder ?? 0,
    isActive: true,
    imageUrl: existing?.imageUrl || '',
    description: existing?.description || partnerKhoSaleNavBlurb(locale),
    descriptionI18n: existing?.descriptionI18n ?? {},
    seoTitle: existing?.seoTitle || '',
    seoDescription: existing?.seoDescription || '',
    seoIndex: existing?.seoIndex ?? true,
    seoBody: existing?.seoBody || '',
    seoBodyGeneratedAt: existing?.seoBodyGeneratedAt ?? null,
    seoBodyGeneratedLocale: existing?.seoBodyGeneratedLocale ?? null,
    sizeGuideImageUrl: existing?.sizeGuideImageUrl || '',
    aiGenerated: false,
    createdAt: existing?.createdAt || '',
    updatedAt: existing?.updatedAt || '',
    children: [],
  }
}

export function partnerCategoryNavHref(
  siteSlug: string,
  node: Pick<PartnerCategoryTreeNode, 'id' | 'path' | 'slug' | 'name'>,
  opts?: { customDomain?: boolean }
): string {
  if (isPartnerKhoSaleNavNode(node)) {
    return partnerSiteKhoSalePath(siteSlug, { customDomain: opts?.customDomain })
  }
  return partnerSiteCategoryPath(siteSlug, node.path, { customDomain: opts?.customDomain })
}

export type PartnerCategoryNavSplit = {
  menuTree: PartnerCategoryTreeNode[]
  seoSizeNodes: PartnerCategoryTreeNode[]
}

/**
 * Mega + pill = ngành hàng L1/L2/L3 giống 188 (Giày dép Nam → Giày tây → oxford…).
 * «Chỉ size *» cấp 1 (sale kho) ẩn hết — không lên menu, không lên hàng SEO.
 * «CHỈ SIZE 43» nằm dưới ngành hàng thật mới vào hàng SEO.
 * Size/SKU kho (nam G04) không lên menu. Có rác kho → chèn «Sale kho» lên đầu.
 */
export function splitPartnerCategoryNavTree(
  tree: PartnerCategoryTreeNode[],
  locale: WebLocale = 'vi'
): PartnerCategoryNavSplit {
  const seenSeo = new Set<string>()
  const seoSizeNodes: PartnerCategoryTreeNode[] = []
  let existingKhoSale: PartnerCategoryTreeNode | undefined
  let hidWarehouseJunk = false

  const takeSeo = (node: PartnerCategoryTreeNode) => {
    if (seenSeo.has(node.id)) return
    seenSeo.add(node.id)
    seoSizeNodes.push({ ...node, children: [] })
  }

  const walk = (nodes: PartnerCategoryTreeNode[], topLevel: boolean): PartnerCategoryTreeNode[] => {
    const kept: PartnerCategoryTreeNode[] = []
    for (const node of nodes) {
      if (isPartnerKhoSaleNavNode(node)) {
        existingKhoSale = existingKhoSale ?? node
        continue
      }
      if (isPartnerCategoryCleanSizeSeoNode(node) && !topLevel) {
        takeSeo(node)
        continue
      }
      if (isPartnerCategoryNavJunkNode(node)) {
        hidWarehouseJunk = true
        continue
      }
      kept.push({ ...node, children: walk(node.children ?? [], false) })
    }
    return kept
  }

  const menuTree = sortIndustryNavTree(walk(tree, true))
  if (existingKhoSale || hidWarehouseJunk) {
    menuTree.unshift(emptyKhoSaleNavNode(locale, existingKhoSale))
  }
  return { menuTree, seoSizeNodes }
}

export type PartnerCategoryMegaMenuCopy = {
  newArrivals: string
  sale: string
  hoverHint: string
  empty: string
  khoSale?: string
  khoSaleBlurb?: string
  khoSaleViewAll?: string
  hubTitle?: string
  close?: string
  expand?: string
  collapse?: string
}

const ACC_CHEVRON =
  '<svg class="pw-cat-acc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>'
const ACC_CLOSE =
  '<svg class="pw-cat-acc-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function khoSalePaneHtml(href: string, copy: PartnerCategoryMegaMenuCopy, locale: WebLocale): string {
  const title = copy.khoSale || partnerKhoSaleNavLabel(locale)
  const blurb = copy.khoSaleBlurb || partnerKhoSaleNavBlurb(locale)
  const more = copy.khoSaleViewAll || partnerKhoSaleViewAllLabel(locale)
  return `<div class="pw-cat-mega-kho" data-pw-kho-sale="1">
<p class="pw-cat-mega-kho-title">${escapeHtml(title)}</p>
<p class="pw-cat-mega-kho-blurb">${escapeHtml(blurb)}</p>
<a href="${escapeHtml(href)}" class="pw-cat-mega-kho-more" data-pw-el="nav-link">${escapeHtml(more)}</a>
</div>`
}

export function buildPartnerSiteCategoryMegaMenuHtml(input: {
  tree: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  productsHref: string
  saleHref: string
  khoSaleHref?: string
  copy: PartnerCategoryMegaMenuCopy
  customDomain?: boolean
}): string {
  const { menuTree: tree } = splitPartnerCategoryNavTree(input.tree, input.locale)
  const { siteSlug, locale, productsHref, saleHref, copy } = input
  const khoSaleHref =
    input.khoSaleHref || partnerSiteKhoSalePath(siteSlug, { customDomain: input.customDomain })
  const firstId = tree[0]?.id ?? ''
  const l1Bits: string[] = [
    `<a href="${escapeHtml(productsHref)}" data-pw-el="nav-link" data-pw-cat-l1="__arrivals">${escapeHtml(copy.newArrivals)}</a>`,
  ]
  const paneBits: string[] = [
    `<div data-pw-cat-pane="__arrivals" hidden><p class="pw-cat-mega-hint">${escapeHtml(copy.hoverHint)}</p></div>`,
  ]

  for (const l1 of tree) {
    const label = isPartnerKhoSaleNavNode(l1)
      ? copy.khoSale || resolvePartnerCategoryDisplayName(l1, locale) || partnerKhoSaleNavLabel(locale)
      : resolvePartnerCategoryDisplayName(l1, locale)
    if (!label) continue
    const href = partnerCategoryNavHref(siteSlug, l1, { customDomain: input.customDomain })
    const active = l1.id === firstId ? ' is-active' : ''
    l1Bits.push(
      `<a href="${escapeHtml(href)}" data-pw-el="nav-link" data-pw-cat-l1="${escapeHtml(l1.id)}" class="${active.trim()}">${escapeHtml(label)}</a>`
    )
    let inner = ''
    if (isPartnerKhoSaleNavNode(l1)) {
      inner = khoSalePaneHtml(khoSaleHref, copy, locale)
    } else {
      const l2 = l1.children ?? []
      if (l2.length === 0) {
        inner = `<p class="pw-cat-mega-hint">${escapeHtml(copy.hoverHint)}</p>`
      } else {
        inner = `<div class="pw-cat-mega-l2-grid">${l2
          .map((child) => {
            const name2 = resolvePartnerCategoryDisplayName(child, locale)
            const href2 = partnerCategoryNavHref(siteSlug, child, { customDomain: input.customDomain })
            const l3 = (child.children ?? [])
              .map((g) => {
                const name3 = resolvePartnerCategoryDisplayName(g, locale)
                const href3 = partnerCategoryNavHref(siteSlug, g, { customDomain: input.customDomain })
                return `<a href="${escapeHtml(href3)}" data-pw-el="nav-link" class="pw-cat-mega-l3">${escapeHtml(name3)}</a>`
              })
              .join('')
            return `<div class="pw-cat-mega-l2-col"><a href="${escapeHtml(href2)}" data-pw-el="nav-link" class="pw-cat-mega-l2">${escapeHtml(name2)}</a>${l3}</div>`
          })
          .join('')}</div>`
      }
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

/** Sheet accordion giống 188 mobile: L1 chữ HOA, L2 thẻ 2 cột, L3 chữ thường. */
export function buildPartnerSiteCategoryMobileAccordionHtml(input: {
  tree: PartnerCategoryTreeNode[]
  siteSlug: string
  locale: WebLocale
  productsHref: string
  saleHref: string
  copy: PartnerCategoryMegaMenuCopy
  customDomain?: boolean
}): string {
  const { menuTree: tree } = splitPartnerCategoryNavTree(input.tree, input.locale)
  const shop = getPartnerSiteShopCopy(input.locale)
  const hubTitle = input.copy.hubTitle || shop.categoryHubTitle
  const closeLabel = input.copy.close || shop.cartAddedClose
  const expandLabel = input.copy.expand || shop.categoryExpand
  const items: string[] = [
    `<div class="pw-cat-acc-item"><div class="pw-cat-acc-l1-row"><a href="${escapeHtml(input.productsHref)}" class="pw-cat-acc-l1-link" data-pw-el="nav-link">${escapeHtml(input.copy.newArrivals)}</a></div></div>`,
  ]

  for (const l1 of tree) {
    const label = isPartnerKhoSaleNavNode(l1)
      ? input.copy.khoSale || resolvePartnerCategoryDisplayName(l1, input.locale) || partnerKhoSaleNavLabel(input.locale)
      : resolvePartnerCategoryDisplayName(l1, input.locale)
    if (!label) continue
    const href = partnerCategoryNavHref(input.siteSlug, l1, { customDomain: input.customDomain })
    const kids = isPartnerKhoSaleNavNode(l1) ? [] : l1.children ?? []
    const chevron = kids.length
      ? `<button type="button" class="pw-cat-acc-toggle" data-pw-cat-acc-toggle="l1" aria-expanded="false" aria-label="${escapeHtml(expandLabel)}">${ACC_CHEVRON}</button>`
      : ''
    let l2html = ''
    if (kids.length) {
      l2html = `<div class="pw-cat-acc-l2-grid" hidden>${kids
        .map((l2) => {
          const name2 = resolvePartnerCategoryDisplayName(l2, input.locale)
          const href2 = partnerCategoryNavHref(input.siteSlug, l2, { customDomain: input.customDomain })
          const l3 = l2.children ?? []
          const chevron2 = l3.length
            ? `<button type="button" class="pw-cat-acc-toggle" data-pw-cat-acc-toggle="l2" aria-expanded="false" aria-label="${escapeHtml(expandLabel)}">${ACC_CHEVRON}</button>`
            : ''
          const l3html = l3.length
            ? `<div class="pw-cat-acc-l3-list" hidden>${l3
                .map((g) => {
                  const name3 = resolvePartnerCategoryDisplayName(g, input.locale)
                  const href3 = partnerCategoryNavHref(input.siteSlug, g, { customDomain: input.customDomain })
                  return `<a href="${escapeHtml(href3)}" class="pw-cat-acc-l3" data-pw-el="nav-link">${escapeHtml(name3)}</a>`
                })
                .join('')}</div>`
            : ''
          return `<div class="pw-cat-acc-l2" data-pw-cat-acc-l2="${escapeHtml(l2.id)}"><div class="pw-cat-acc-l2-row"><a href="${escapeHtml(href2)}" class="pw-cat-acc-l2-link" data-pw-el="nav-link">${escapeHtml(name2)}</a>${chevron2}</div>${l3html}</div>`
        })
        .join('')}</div>`
    }
    items.push(
      `<div class="pw-cat-acc-item" data-pw-cat-acc-l1="${escapeHtml(l1.id)}"><div class="pw-cat-acc-l1-row"><a href="${escapeHtml(href)}" class="pw-cat-acc-l1-link" data-pw-el="nav-link">${escapeHtml(label)}</a>${chevron}</div>${l2html}</div>`
    )
  }

  return `<div class="pw-cat-acc" data-pw-cat-acc="1">
<div class="pw-cat-acc-bar"><span class="pw-cat-acc-title">${escapeHtml(hubTitle)}</span><button type="button" class="pw-cat-acc-close" data-pw-cat-acc-close>${ACC_CLOSE}<span>${escapeHtml(closeLabel)}</span></button></div>
<nav class="pw-cat-acc-list" aria-label="${escapeHtml(hubTitle)}">${items.join('')}</nav>
<a href="${escapeHtml(input.saleHref)}" class="pw-cat-acc-sale is-sale" data-pw-el="nav-link">${escapeHtml(input.copy.sale)}</a>
</div>`
}
