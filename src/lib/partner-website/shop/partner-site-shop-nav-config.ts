import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
  partnerSiteAccountTabPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
  partnerSiteRecentlyViewedPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export type PartnerSiteAccountMenuItemId =
  | 'account'
  | 'edit-profile'
  | 'cart'
  | 'orders'
  | 'wallet'
  | 'recently-viewed'
  | 'addresses'
  | 'wishlist'
  | 'contact'
  | 'security'
  | 'notifications'
  | 'install-app'

export type PartnerSiteAccountMenuItem = {
  id: PartnerSiteAccountMenuItemId
  href: string
  label: string
  isHeader?: boolean
  isAccent?: boolean
}

export type PartnerSiteCategoryNavLabels = {
  newArrivals: string
  clothing: string
  bags: string
  shoes: string
  accessories: string
  sale: string
  contact: string
  login: string
  about: string
  faq: string
  shipping: string
  returns: string
  privacy: string
  terms: string
  /** W3.2 */
  payment: string
  stores: string
  lookbook: string
  sizeGuide: string
  blog: string
}

export type PartnerSiteShopNavPaths = {
  home: string
  products: string
  sale: string
  wishlist: string
  cart: string
  orders: string
  account: string
  addresses: string
  recentlyViewed: string
  contact: string
}

/** Category row + footer info labels — shared by React shell and HTML template. */
export function getPartnerSiteCategoryNavLabels(locale: WebLocale): PartnerSiteCategoryNavLabels {
  if (locale === 'vi') {
    return {
      newArrivals: 'Hàng mới',
      clothing: 'Thời trang',
      bags: 'Túi xách',
      shoes: 'Giày dép',
      accessories: 'Phụ kiện',
      sale: 'Khuyến mãi',
      contact: 'Liên hệ',
      login: 'Đăng nhập',
      about: 'Về chúng tôi',
      faq: 'FAQ',
      shipping: 'Vận chuyển',
      returns: 'Đổi trả',
      privacy: 'Bảo mật',
      terms: 'Điều khoản',
      payment: 'Thanh toán',
      stores: 'Cửa hàng',
      lookbook: 'Lookbook',
      sizeGuide: 'Hướng dẫn size',
      blog: 'Blog',
    }
  }
  if (locale === 'zh') {
    return {
      newArrivals: '新品',
      clothing: '服装',
      bags: '箱包',
      shoes: '鞋履',
      accessories: '配饰',
      sale: '促销',
      contact: '联系我们',
      login: '登录',
      about: '关于我们',
      faq: 'FAQ',
      shipping: '配送',
      returns: '退换',
      privacy: '隐私',
      terms: '条款',
      payment: '支付说明',
      stores: '门店',
      lookbook: 'Lookbook',
      sizeGuide: '尺码指南',
      blog: '博客',
    }
  }
  if (locale === 'ja') {
    return {
      newArrivals: '新着',
      clothing: 'ファッション',
      bags: 'バッグ',
      shoes: 'シューズ',
      accessories: 'アクセサリー',
      sale: 'セール',
      contact: 'お問い合わせ',
      login: 'ログイン',
      about: '会社概要',
      faq: 'FAQ',
      shipping: '配送',
      returns: '返品',
      privacy: 'プライバシー',
      terms: '利用規約',
      payment: 'お支払い',
      stores: '店舗',
      lookbook: 'ルックブック',
      sizeGuide: 'サイズガイド',
      blog: 'ブログ',
    }
  }
  if (locale === 'ko') {
    return {
      newArrivals: '신상품',
      clothing: '패션',
      bags: '가방',
      shoes: '신발',
      accessories: '액세서리',
      sale: '세일',
      contact: '문의',
      login: '로그인',
      about: '소개',
      faq: 'FAQ',
      shipping: '배송',
      returns: '교환·반품',
      privacy: '개인정보',
      terms: '이용약관',
      payment: '결제 안내',
      stores: '매장',
      lookbook: '룩북',
      sizeGuide: '사이즈 가이드',
      blog: '블로그',
    }
  }
  return {
    newArrivals: 'NEW ARRIVALS',
    clothing: 'CLOTHING',
    bags: 'HANDBAGS',
    shoes: 'SHOES',
    accessories: 'ACCESSORIES',
    sale: 'SALE',
    contact: 'Contact us',
    login: 'Log in',
    about: 'About us',
    faq: 'FAQ',
    shipping: 'Shipping',
    returns: 'Returns',
    privacy: 'Privacy',
    terms: 'Terms',
    payment: 'Payment',
    stores: 'Stores',
    lookbook: 'Lookbook',
    sizeGuide: 'Size guide',
    blog: 'Blog',
  }
}

/** React shop routes — single source for header / account menu links. */
export function getPartnerSiteShopNavPaths(siteSlug: string, customDomain = false): PartnerSiteShopNavPaths {
  const slug = siteSlug.trim()
  const pathOpts = { customDomain }
  return {
    home: partnerSiteHomePath(slug, pathOpts),
    products: partnerSiteProductsPath(slug, pathOpts),
    sale: partnerSiteInfoPath(slug, 'sale', pathOpts),
    wishlist: partnerSiteWishlistPath(slug, pathOpts),
    cart: partnerSiteCartPath(slug, pathOpts),
    orders: partnerSiteOrdersPath(slug, pathOpts),
    account: partnerSiteAccountPath(slug, pathOpts),
    addresses: partnerSiteAddressesPath(slug, pathOpts),
    recentlyViewed: partnerSiteRecentlyViewedPath(slug, pathOpts),
    contact: partnerSiteInfoPath(slug, 'contact', pathOpts),
  }
}

/**
 * Account dropdown items — same order/labels in React shell and HTML preview.
 * When `siteSlug` is empty (gallery sample), links fall back to in-page anchors.
 */
export function getPartnerSiteAccountMenuItems(input: {
  siteSlug: string
  locale: WebLocale
  customDomain?: boolean
}): PartnerSiteAccountMenuItem[] {
  const t = getPartnerSiteShopCopy(input.locale)
  const slug = input.siteSlug.trim()
  const paths = slug
    ? getPartnerSiteShopNavPaths(slug, input.customDomain)
    : {
        account: '#lead-form',
        cart: '#products',
        orders: '#lead-form',
        recentlyViewed: '#products',
        addresses: '#lead-form',
        wishlist: '#products',
        contact: '#lead-form',
      }

  const tab = (id: Parameters<typeof partnerSiteAccountTabPath>[1], fallback: string) =>
    slug ? partnerSiteAccountTabPath(slug, id, { customDomain: input.customDomain }) : fallback

  return [
    {
      id: 'edit-profile',
      href: slug ? partnerSiteAccountEditPath(slug, { customDomain: input.customDomain }) : paths.account,
      label: t.accountEditProfile,
      isAccent: true,
    },
    { id: 'cart', href: tab('cart', paths.cart), label: t.navCart },
    { id: 'orders', href: tab('orders', paths.orders), label: t.navOrders },
    { id: 'wallet', href: tab('wallet', paths.account), label: t.navWallet },
    { id: 'wishlist', href: tab('wishlist', paths.wishlist), label: t.navFavorites },
    { id: 'recently-viewed', href: tab('recently-viewed', paths.recentlyViewed), label: t.accountViewedProducts },
    { id: 'addresses', href: tab('addresses', paths.addresses), label: t.accountAddressBook },
    { id: 'security', href: tab('security', paths.account), label: t.accountSecurity },
    { id: 'notifications', href: tab('notifications', paths.account), label: t.accountNotifications },
    { id: 'install-app', href: tab('install-app', paths.account), label: t.accountInstallApp },
    { id: 'contact', href: tab('contact', paths.contact), label: getPartnerSiteCategoryNavLabels(input.locale).contact },
  ]
}

/** Inline SVG for account dropdown rows (HTML chrome + bootstrap). */
export function partnerSiteAccountMenuIconSvg(id: PartnerSiteAccountMenuItemId): string {
  const paths: Record<PartnerSiteAccountMenuItemId, string> = {
    account: '<circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/>',
    'edit-profile': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    cart: '<path d="M3 4h2l2.2 11h9.6L19 7H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>',
    orders:
      '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>',
    wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/>',
    wishlist:
      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    'recently-viewed': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    addresses:
      '<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    security: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    notifications:
      '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'install-app': '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 21h16"/>',
    contact:
      '<path d="M6 4h4l2 5-2 1a12 12 0 0 0 6 6l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
  }
  return `<svg class="pw-shop-account-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]}</svg>`
}

export function getPartnerSitePromoNavLabel(locale: WebLocale): string {
  const n = getPartnerSiteCategoryNavLabels(locale)
  if (locale === 'vi') return n.sale
  if (locale === 'zh') return n.sale
  if (locale === 'ja') return n.sale
  if (locale === 'ko') return n.sale
  return 'Promotions'
}
