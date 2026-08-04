import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
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
  | 'recently-viewed'
  | 'addresses'
  | 'wishlist'
  | 'contact'

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
      }

  return [
    { id: 'account', href: paths.account, label: t.navAccount, isHeader: true },
    {
      id: 'edit-profile',
      href: slug ? partnerSiteAccountEditPath(slug, { customDomain: input.customDomain }) : paths.account,
      label: t.accountEditProfile,
      isAccent: true,
    },
    { id: 'cart', href: slug ? `${paths.account}#cart` : paths.cart, label: t.navCart },
    { id: 'orders', href: slug ? `${paths.account}#orders` : paths.orders, label: t.navOrders },
    { id: 'wishlist', href: slug ? `${paths.account}#wishlist` : paths.wishlist, label: t.navFavorites },
    { id: 'recently-viewed', href: slug ? `${paths.account}#recently-viewed` : paths.recentlyViewed, label: t.accountViewedProducts },
    { id: 'addresses', href: slug ? `${paths.account}#addresses` : paths.addresses, label: t.accountAddressBook },
    { id: 'contact', href: slug ? `${paths.account}#contact` : paths.contact, label: getPartnerSiteCategoryNavLabels(input.locale).contact },
  ]
}

export function getPartnerSitePromoNavLabel(locale: WebLocale): string {
  const n = getPartnerSiteCategoryNavLabels(locale)
  if (locale === 'vi') return n.sale
  if (locale === 'zh') return n.sale
  if (locale === 'ja') return n.sale
  if (locale === 'ko') return n.sale
  return 'Promotions'
}
