import { PW_BG_REGION_ROLES } from './pw-bg-stack'

/**
 * Hợp đồng định danh UI shop/landing cho Sửa nhanh.
 * Mọi khối gốc bắt buộc `data-pw-region`. Mọi phần tử sửa được bắt buộc `data-pw-el`.
 * Sửa nhanh đọc mã này trước, không đoán bằng class / kích thước / chữ nút.
 *
 * Bốn lớp (không trộn):
 * - page   = loại trang (home / listing / product / …)
 * - region = khối gốc (banner ≠ catalog)
 * - el     = vai trò phần tử trong khối (title / cta / card-price)
 * - edit   = ô nội dung cụ thể (heroTitle / categoryName:0)
 * Nền xếp lớp: `data-pw-bg-role` (pw-bg-stack.ts) — cùng tên region khi có.
 * Màu: `data-pw-token` → `--pw-*`, không hex thương hiệu.
 */

export const PW_PAGE = {
  home: 'home',
  listing: 'listing',
  product: 'product',
  cart: 'cart',
  account: 'account',
  info: 'info',
  landing: 'landing',
} as const

export type PwPageKind = (typeof PW_PAGE)[keyof typeof PW_PAGE]

export const PW_REGION = {
  header: 'header',
  nav: 'nav',
  topbar: 'topbar',
  banner: 'banner',
  categories: 'categories',
  catalog: 'catalog',
  filters: 'filters',
  toolbar: 'toolbar',
  breadcrumb: 'breadcrumb',
  gallery: 'gallery',
  pdpInfo: 'pdp-info',
  reviews: 'reviews',
  cartList: 'cart-list',
  cartSummary: 'cart-summary',
  promo: 'promo',
  content: 'content',
  form: 'form',
  footer: 'footer',
  accountNav: 'account-nav',
  accountMain: 'account-main',
} as const

export type PwRegionKind = (typeof PW_REGION)[keyof typeof PW_REGION]

export const PW_EL = {
  logo: 'logo',
  wordmark: 'wordmark',
  search: 'search',
  catToggle: 'cat-toggle',
  account: 'account',
  cart: 'cart',
  navLink: 'nav-link',
  inner: 'inner',
  media: 'media',
  copy: 'copy',
  badge: 'badge',
  title: 'title',
  subtitle: 'subtitle',
  cta: 'cta',
  ctaSecondary: 'cta-secondary',
  dots: 'dots',
  sectionTitle: 'section-title',
  sectionMore: 'section-more',
  grid: 'grid',
  card: 'card',
  cardMedia: 'card-media',
  cardName: 'card-name',
  cardPrice: 'card-price',
  cardCart: 'card-cart',
  cardBuy: 'card-buy',
  col: 'col',
  link: 'link',
  copyright: 'copyright',
  announcement: 'announcement',
  facet: 'facet',
  sort: 'sort',
  count: 'count',
  crumb: 'crumb',
  mainImage: 'main-image',
  thumb: 'thumb',
  price: 'price',
  comparePrice: 'compare-price',
  variant: 'variant',
  qty: 'qty',
  buy: 'buy',
  wishlist: 'wishlist',
  sku: 'sku',
  desc: 'desc',
  heading: 'heading',
  body: 'body',
  image: 'image',
  faqItem: 'faq-item',
  label: 'label',
  field: 'field',
  submit: 'submit',
  line: 'line',
  remove: 'remove',
  coupon: 'coupon',
  checkout: 'checkout',
  menuItem: 'menu-item',
  empty: 'empty',
} as const

export type PwElKind = (typeof PW_EL)[keyof typeof PW_EL]

/** Hành động Sửa nhanh được phép trên một phần tử. */
export const PW_CAP = {
  text: 'text',
  href: 'href',
  image: 'image',
  mediaPan: 'media-pan',
  hide: 'hide',
  token: 'token',
  move: 'move',
  lock: 'lock',
} as const

export type PwCapKind = (typeof PW_CAP)[keyof typeof PW_CAP]

/** Token màu — khớp `--pw-*` trong themeCssVarMap. */
export const PW_TOKEN = {
  primary: 'primary',
  accent: 'accent',
  buy: 'buy',
  cart: 'cart',
  bg: 'bg',
  text: 'text',
  muted: 'muted',
  surface: 'surface',
  border: 'border',
  footer: 'footer',
} as const

export type PwTokenKind = (typeof PW_TOKEN)[keyof typeof PW_TOKEN]

export const PW_TOKEN_CSS_VAR: Record<PwTokenKind, string> = {
  primary: '--pw-primary',
  accent: '--pw-accent',
  buy: '--pw-buy',
  cart: '--pw-cart',
  bg: '--pw-bg',
  text: '--pw-text',
  muted: '--pw-muted',
  surface: '--pw-surface',
  border: '--pw-border',
  footer: '--pw-footer',
}

/** Ô nội dung đã chốt trên home fashion — `{slot}` hoặc `{slot}:{index}`. */
export const PW_EDIT_SLOT = {
  heroImage: 'heroImage',
  heroTitle: 'heroTitle',
  heroSubtitle: 'heroSubtitle',
  heroCta: 'heroCta',
  heroBadge: 'heroBadge',
  categoriesTitle: 'categoriesTitle',
  categoryImage: 'categoryImage',
  categoryName: 'categoryName',
  newArrivalsTitle: 'newArrivalsTitle',
  bestSellersTitle: 'bestSellersTitle',
} as const

export type PwEditSlotKind = (typeof PW_EDIT_SLOT)[keyof typeof PW_EDIT_SLOT]

export const PW_PAGE_ATTR = 'data-pw-page'
export const PW_REGION_ATTR = 'data-pw-region'
export const PW_EL_ATTR = 'data-pw-el'
export const PW_TOKEN_ATTR = 'data-pw-token'
export const PW_EDIT_ATTR = 'data-pw-edit'

export const PW_PAGE_VALUES = Object.values(PW_PAGE)
export const PW_REGION_VALUES = Object.values(PW_REGION)
export const PW_EL_VALUES = Object.values(PW_EL)
export const PW_CAP_VALUES = Object.values(PW_CAP)
export const PW_TOKEN_VALUES = Object.values(PW_TOKEN)

const PW_PAGE_SET = new Set<string>(PW_PAGE_VALUES)
const PW_REGION_SET = new Set<string>(PW_REGION_VALUES)
const PW_EL_SET = new Set<string>(PW_EL_VALUES)
const PW_CAP_SET = new Set<string>(PW_CAP_VALUES)
const PW_TOKEN_SET = new Set<string>(PW_TOKEN_VALUES)

export function isPwPageKind(raw: string | null | undefined): raw is PwPageKind {
  return PW_PAGE_SET.has(String(raw || ''))
}

export function isPwRegionKind(raw: string | null | undefined): raw is PwRegionKind {
  return PW_REGION_SET.has(String(raw || ''))
}

export function isPwElKind(raw: string | null | undefined): raw is PwElKind {
  return PW_EL_SET.has(String(raw || ''))
}

export function isPwCapKind(raw: string | null | undefined): raw is PwCapKind {
  return PW_CAP_SET.has(String(raw || ''))
}

export function isPwTokenKind(raw: string | null | undefined): raw is PwTokenKind {
  return PW_TOKEN_SET.has(String(raw || ''))
}

export function pwPageAttr(page: PwPageKind): string {
  return `${PW_PAGE_ATTR}="${page}"`
}

export function pwRegionAttr(region: PwRegionKind): string {
  return `${PW_REGION_ATTR}="${region}"`
}

export function pwElAttr(el: PwElKind): string {
  return `${PW_EL_ATTR}="${el}"`
}

export function pwTokenAttr(token: PwTokenKind): string {
  return `${PW_TOKEN_ATTR}="${token}"`
}

export function pwPageProps(page: PwPageKind): { 'data-pw-page': PwPageKind } {
  return { 'data-pw-page': page }
}

export function pwRegionProps(region: PwRegionKind): { 'data-pw-region': PwRegionKind } {
  return { 'data-pw-region': region }
}

export function pwElProps(el: PwElKind): { 'data-pw-el': PwElKind } {
  return { 'data-pw-el': el }
}

export function pwTokenProps(token: PwTokenKind): { 'data-pw-token': PwTokenKind } {
  return { 'data-pw-token': token }
}

/** Catalog key (partner-website-page-catalog) → nhóm trang editor. */
export const PW_PAGE_BY_CATALOG_KEY: Record<string, PwPageKind> = {
  home: PW_PAGE.home,
  products: PW_PAGE.listing,
  collection: PW_PAGE.listing,
  sale: PW_PAGE.listing,
  lookbook: PW_PAGE.listing,
  product_detail: PW_PAGE.product,
  cart: PW_PAGE.cart,
  account: PW_PAGE.account,
  orders: PW_PAGE.account,
  addresses: PW_PAGE.account,
  wishlist: PW_PAGE.account,
  recently_viewed: PW_PAGE.account,
  about: PW_PAGE.info,
  contact: PW_PAGE.info,
  faq: PW_PAGE.info,
  size_guide: PW_PAGE.info,
  shipping: PW_PAGE.info,
  returns: PW_PAGE.info,
  privacy: PW_PAGE.info,
  cookie: PW_PAGE.info,
  terms: PW_PAGE.info,
  stores: PW_PAGE.info,
  blog: PW_PAGE.info,
  payment: PW_PAGE.info,
  thank_you: PW_PAGE.info,
  order_tracking: PW_PAGE.info,
}

export function pwPageKindOf(catalogKey: string | null | undefined): PwPageKind | null {
  const key = String(catalogKey || '').trim()
  if (!key) return null
  if (isPwPageKind(key)) return key
  return PW_PAGE_BY_CATALOG_KEY[key] ?? null
}

export function parsePwEditSlot(raw: string | null | undefined): { name: string; index: number | null } | null {
  const value = String(raw || '').trim()
  if (!value) return null
  const split = value.lastIndexOf(':')
  if (split > 0) {
    const name = value.slice(0, split)
    const index = Number(value.slice(split + 1))
    if (name && Number.isInteger(index) && index >= 0) return { name, index }
  }
  return { name: value, index: null }
}

/** Khối Sửa nhanh được phép tách Khối/Ảnh (banner). */
export const PW_IMAGE_LAYER_REGIONS: readonly PwRegionKind[] = [PW_REGION.banner]

/** Khối catalog: khóa card/giá/nút mua — không kéo từng SKU. */
export const PW_LOCKED_REGIONS: readonly PwRegionKind[] = [PW_REGION.catalog]

/**
 * Region chứa dữ liệu live (kho / đơn / UGC).
 * Không đổi `isPwLockedRegion` (vẫn chỉ catalog) — editor cũ dựa vào đó.
 */
export const PW_LIVE_DATA_REGIONS: readonly PwRegionKind[] = [
  PW_REGION.catalog,
  PW_REGION.gallery,
  PW_REGION.pdpInfo,
  PW_REGION.reviews,
  PW_REGION.cartList,
  PW_REGION.cartSummary,
]

/** Region ↔ data-pw-bg-role — cùng tên khi region được phép có nền. nav/topbar/filters… không có lớp riêng. */
export const PW_REGION_BG_ROLE: Partial<Record<PwRegionKind, string>> = Object.fromEntries(
  PW_BG_REGION_ROLES.map((role) => [role, role])
) as Partial<Record<PwRegionKind, string>>

export const PW_CHROME_REGIONS: readonly PwRegionKind[] = [
  PW_REGION.header,
  PW_REGION.nav,
  PW_REGION.topbar,
  PW_REGION.footer,
]

export const PW_PAGE_REGIONS: Record<PwPageKind, readonly PwRegionKind[]> = {
  [PW_PAGE.home]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.banner,
    PW_REGION.categories,
    PW_REGION.catalog,
    PW_REGION.promo,
    PW_REGION.footer,
  ],
  [PW_PAGE.listing]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.breadcrumb,
    PW_REGION.categories,
    PW_REGION.filters,
    PW_REGION.toolbar,
    PW_REGION.catalog,
    PW_REGION.footer,
  ],
  [PW_PAGE.product]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.breadcrumb,
    PW_REGION.gallery,
    PW_REGION.pdpInfo,
    PW_REGION.reviews,
    PW_REGION.catalog,
    PW_REGION.footer,
  ],
  [PW_PAGE.cart]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.cartList,
    PW_REGION.cartSummary,
    PW_REGION.form,
    PW_REGION.catalog,
    PW_REGION.footer,
  ],
  [PW_PAGE.account]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.accountNav,
    PW_REGION.accountMain,
    PW_REGION.form,
    PW_REGION.catalog,
    PW_REGION.footer,
  ],
  [PW_PAGE.info]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.topbar,
    PW_REGION.content,
    PW_REGION.form,
    PW_REGION.footer,
  ],
  [PW_PAGE.landing]: [
    PW_REGION.header,
    PW_REGION.nav,
    PW_REGION.banner,
    PW_REGION.categories,
    PW_REGION.catalog,
    PW_REGION.promo,
    PW_REGION.content,
    PW_REGION.form,
    PW_REGION.footer,
  ],
}

export const PW_REGION_ELS: Record<PwRegionKind, readonly PwElKind[]> = {
  [PW_REGION.header]: [
    PW_EL.logo,
    PW_EL.wordmark,
    PW_EL.search,
    PW_EL.catToggle,
    PW_EL.account,
    PW_EL.cart,
    PW_EL.navLink,
  ],
  [PW_REGION.nav]: [PW_EL.navLink],
  [PW_REGION.topbar]: [PW_EL.announcement, PW_EL.link],
  [PW_REGION.banner]: [
    PW_EL.media,
    PW_EL.inner,
    PW_EL.copy,
    PW_EL.badge,
    PW_EL.title,
    PW_EL.subtitle,
    PW_EL.cta,
    PW_EL.ctaSecondary,
    PW_EL.dots,
  ],
  [PW_REGION.categories]: [
    PW_EL.sectionTitle,
    PW_EL.sectionMore,
    PW_EL.grid,
    PW_EL.card,
    PW_EL.cardMedia,
    PW_EL.cardName,
  ],
  [PW_REGION.catalog]: [
    PW_EL.sectionTitle,
    PW_EL.sectionMore,
    PW_EL.grid,
    PW_EL.card,
    PW_EL.cardMedia,
    PW_EL.cardName,
    PW_EL.cardPrice,
    PW_EL.cardCart,
    PW_EL.cardBuy,
  ],
  [PW_REGION.filters]: [PW_EL.sectionTitle, PW_EL.facet],
  [PW_REGION.toolbar]: [PW_EL.sectionTitle, PW_EL.sort, PW_EL.count],
  [PW_REGION.breadcrumb]: [PW_EL.crumb, PW_EL.link],
  [PW_REGION.gallery]: [PW_EL.mainImage, PW_EL.thumb, PW_EL.media],
  [PW_REGION.pdpInfo]: [
    PW_EL.title,
    PW_EL.badge,
    PW_EL.price,
    PW_EL.comparePrice,
    PW_EL.variant,
    PW_EL.qty,
    PW_EL.buy,
    PW_EL.cardCart,
    PW_EL.wishlist,
    PW_EL.sku,
    PW_EL.desc,
    PW_EL.cta,
  ],
  [PW_REGION.reviews]: [PW_EL.sectionTitle, PW_EL.card, PW_EL.cardName, PW_EL.body],
  [PW_REGION.cartList]: [
    PW_EL.sectionTitle,
    PW_EL.line,
    PW_EL.cardName,
    PW_EL.cardMedia,
    PW_EL.cardPrice,
    PW_EL.qty,
    PW_EL.remove,
    PW_EL.empty,
  ],
  [PW_REGION.cartSummary]: [PW_EL.title, PW_EL.price, PW_EL.coupon, PW_EL.checkout, PW_EL.cta],
  [PW_REGION.promo]: [
    PW_EL.media,
    PW_EL.copy,
    PW_EL.badge,
    PW_EL.title,
    PW_EL.subtitle,
    PW_EL.cta,
    PW_EL.ctaSecondary,
  ],
  [PW_REGION.content]: [
    PW_EL.heading,
    PW_EL.body,
    PW_EL.image,
    PW_EL.title,
    PW_EL.subtitle,
    PW_EL.faqItem,
    PW_EL.link,
    PW_EL.cta,
  ],
  [PW_REGION.form]: [PW_EL.title, PW_EL.subtitle, PW_EL.label, PW_EL.field, PW_EL.submit],
  [PW_REGION.footer]: [PW_EL.logo, PW_EL.col, PW_EL.link, PW_EL.copyright],
  [PW_REGION.accountNav]: [PW_EL.title, PW_EL.menuItem],
  [PW_REGION.accountMain]: [
    PW_EL.heading,
    PW_EL.body,
    PW_EL.label,
    PW_EL.field,
    PW_EL.submit,
    PW_EL.empty,
    PW_EL.card,
  ],
}

const TEXT: readonly PwCapKind[] = [PW_CAP.text]
const TEXT_HREF: readonly PwCapKind[] = [PW_CAP.text, PW_CAP.href]
const TEXT_HIDE: readonly PwCapKind[] = [PW_CAP.text, PW_CAP.hide]
const IMAGE: readonly PwCapKind[] = [PW_CAP.image]
const IMAGE_PAN_HIDE: readonly PwCapKind[] = [PW_CAP.image, PW_CAP.mediaPan, PW_CAP.hide]
const IMAGE_PAN: readonly PwCapKind[] = [PW_CAP.image, PW_CAP.mediaPan]
const HIDE: readonly PwCapKind[] = [PW_CAP.hide]
const MOVE_TOKEN: readonly PwCapKind[] = [PW_CAP.move, PW_CAP.token]
const TOKEN: readonly PwCapKind[] = [PW_CAP.token]
const LOCK: readonly PwCapKind[] = [PW_CAP.lock]

const PW_EL_CAPS: Record<PwElKind, readonly PwCapKind[]> = {
  [PW_EL.logo]: IMAGE_PAN_HIDE,
  [PW_EL.wordmark]: TEXT_HIDE,
  [PW_EL.search]: HIDE,
  [PW_EL.catToggle]: HIDE,
  [PW_EL.account]: HIDE,
  [PW_EL.cart]: HIDE,
  [PW_EL.navLink]: TEXT_HREF,
  [PW_EL.inner]: MOVE_TOKEN,
  [PW_EL.media]: IMAGE_PAN,
  [PW_EL.copy]: MOVE_TOKEN,
  [PW_EL.badge]: TEXT_HIDE,
  [PW_EL.title]: TEXT,
  [PW_EL.subtitle]: TEXT,
  [PW_EL.cta]: TEXT_HREF,
  [PW_EL.ctaSecondary]: TEXT_HREF,
  [PW_EL.dots]: HIDE,
  [PW_EL.sectionTitle]: TEXT,
  [PW_EL.sectionMore]: TEXT_HREF,
  [PW_EL.grid]: TOKEN,
  [PW_EL.card]: TOKEN,
  [PW_EL.cardMedia]: IMAGE,
  [PW_EL.cardName]: TEXT,
  [PW_EL.cardPrice]: LOCK,
  [PW_EL.cardCart]: LOCK,
  [PW_EL.cardBuy]: LOCK,
  [PW_EL.col]: TOKEN,
  [PW_EL.link]: TEXT_HREF,
  [PW_EL.copyright]: TEXT,
  [PW_EL.announcement]: TEXT_HIDE,
  [PW_EL.facet]: LOCK,
  [PW_EL.sort]: HIDE,
  [PW_EL.count]: LOCK,
  [PW_EL.crumb]: TEXT_HREF,
  [PW_EL.mainImage]: LOCK,
  [PW_EL.thumb]: LOCK,
  [PW_EL.price]: LOCK,
  [PW_EL.comparePrice]: LOCK,
  [PW_EL.variant]: LOCK,
  [PW_EL.qty]: LOCK,
  [PW_EL.buy]: LOCK,
  [PW_EL.wishlist]: HIDE,
  [PW_EL.sku]: LOCK,
  [PW_EL.desc]: LOCK,
  [PW_EL.heading]: TEXT,
  [PW_EL.body]: TEXT,
  [PW_EL.image]: IMAGE,
  [PW_EL.faqItem]: TEXT,
  [PW_EL.label]: TEXT,
  [PW_EL.field]: HIDE,
  [PW_EL.submit]: TEXT,
  [PW_EL.line]: LOCK,
  [PW_EL.remove]: LOCK,
  [PW_EL.coupon]: HIDE,
  [PW_EL.checkout]: TEXT_HREF,
  [PW_EL.menuItem]: TEXT_HREF,
  [PW_EL.empty]: TEXT,
}

const PW_REGION_EL_CAP_OVERRIDES: Partial<Record<PwRegionKind, Partial<Record<PwElKind, readonly PwCapKind[]>>>> = {
  [PW_REGION.catalog]: {
    [PW_EL.card]: LOCK,
    [PW_EL.cardMedia]: LOCK,
    [PW_EL.cardName]: LOCK,
    [PW_EL.cardPrice]: LOCK,
    [PW_EL.cardCart]: LOCK,
    [PW_EL.cardBuy]: LOCK,
  },
  [PW_REGION.gallery]: {
    [PW_EL.media]: LOCK,
    [PW_EL.mainImage]: LOCK,
    [PW_EL.thumb]: LOCK,
  },
  [PW_REGION.pdpInfo]: {
    [PW_EL.title]: LOCK,
    [PW_EL.badge]: LOCK,
    [PW_EL.cta]: LOCK,
  },
  [PW_REGION.reviews]: {
    [PW_EL.card]: LOCK,
    [PW_EL.cardName]: LOCK,
    [PW_EL.body]: LOCK,
  },
  [PW_REGION.cartList]: {
    [PW_EL.cardName]: LOCK,
    [PW_EL.cardMedia]: LOCK,
    [PW_EL.cardPrice]: LOCK,
    [PW_EL.qty]: LOCK,
  },
  [PW_REGION.cartSummary]: {
    [PW_EL.price]: LOCK,
  },
}

export function pwElsForRegion(region: string | null | undefined): readonly PwElKind[] {
  if (!isPwRegionKind(region)) return []
  return PW_REGION_ELS[region]
}

export function regionAllowsEl(region: string | null | undefined, el: string | null | undefined): boolean {
  if (!isPwRegionKind(region) || !isPwElKind(el)) return false
  return PW_REGION_ELS[region].includes(el)
}

export function pageAllowsRegion(page: string | null | undefined, region: string | null | undefined): boolean {
  if (!isPwPageKind(page) || !isPwRegionKind(region)) return false
  return PW_PAGE_REGIONS[page].includes(region)
}

export function pwCapsOf(el: string | null | undefined, region?: string | null): readonly PwCapKind[] {
  if (!isPwElKind(el)) return []
  if (isPwRegionKind(region)) {
    const override = PW_REGION_EL_CAP_OVERRIDES[region]?.[el]
    if (override) return override
  }
  return PW_EL_CAPS[el]
}

export function pwHasCap(
  el: string | null | undefined,
  cap: PwCapKind,
  region?: string | null
): boolean {
  return pwCapsOf(el, region).includes(cap)
}

export function pwIsLiveLocked(el: string | null | undefined, region?: string | null): boolean {
  return pwHasCap(el, PW_CAP.lock, region)
}

export function isPwImageLayerRegion(region: string | null | undefined): boolean {
  return region === PW_REGION.banner
}

export function isPwLockedRegion(region: string | null | undefined): boolean {
  return region === PW_REGION.catalog
}

export function isPwLiveDataRegion(region: string | null | undefined): boolean {
  return isPwRegionKind(region) && PW_LIVE_DATA_REGIONS.includes(region)
}

export function isPwCatalogTitleEl(el: string | null | undefined): boolean {
  return el === PW_EL.sectionTitle || el === PW_EL.sectionMore
}

export function pwBgRoleForRegion(region: string | null | undefined): string | null {
  if (!isPwRegionKind(region)) return null
  return PW_REGION_BG_ROLE[region] ?? null
}
