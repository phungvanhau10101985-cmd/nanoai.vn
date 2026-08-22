/** Nhận kind nút chrome từ href + chữ trên chính nút — không tin `/account` trước kind cụ thể. */

export type ChromeKindHints = {
  stamped?: string | null
  href?: string | null
  className?: string | null
  label?: string | null
  contactChannel?: string | null
  openChat?: boolean
  tryOn?: boolean
  favorite?: boolean
  addCart?: boolean
  buyNow?: boolean
}

export type ChromeKindInferRule = {
  kind: string
  pathSegs?: string[]
  lastSegs?: string[]
  labels?: string[]
  classes?: string[]
  hrefIncludes?: string[]
  channels?: string[]
}

/** Alias topbar chữ thuần — cùng glyph / cùng API với kind chuẩn. */
export const CHROME_KIND_ALIASES: Record<string, string> = {
  'favorites-link': 'wishlist',
  'orders-link': 'orders',
}

/**
 * Thứ tự = độ ưu tiên. Kind cụ thể (wishlist, contact, orders…) trước `account`.
 * Nhãn đủ 5 locale storefront. Editor iframe nhúng bảng này qua JSON — không copy regex.
 */
export const CHROME_KIND_INFER_RULES: ChromeKindInferRule[] = [
  {
    kind: 'chat-zalo',
    hrefIncludes: ['zalo.me', 'zalo.zalo', 'zaloapp'],
    channels: ['zalo'],
    labels: ['chat zalo', 'zalo chat', 'zalo 聊天', 'zaloチャット', 'zalo 채팅'],
  },
  {
    kind: 'chat-facebook',
    hrefIncludes: ['messenger.com', 'm.me/', 'facebook.com/messages'],
    channels: ['facebook', 'messenger'],
    labels: ['chat facebook', 'facebook chat', 'messenger', 'facebook 聊天', 'facebookチャット', 'facebook 채팅'],
  },
  {
    kind: 'chat-instagram',
    hrefIncludes: ['instagram.com'],
    channels: ['instagram'],
    labels: ['instagram', 'insta', 'ig'],
  },
  {
    kind: 'chat-whatsapp',
    hrefIncludes: ['wa.me', 'whatsapp.com', 'api.whatsapp'],
    channels: ['whatsapp'],
    labels: ['whatsapp', 'chat whatsapp'],
  },
  {
    kind: 'phone',
    hrefIncludes: ['tel:'],
    channels: ['phone', 'hotline'],
    labels: ['gọi điện', 'goi dien', 'hotline', 'call', 'phone', '电话', '電話', '전화'],
  },
  {
    kind: 'share',
    labels: ['chia sẻ', 'chia se', 'share', 'copy link', 'sao chép link', '分享', 'シェア', '공유'],
  },
  {
    kind: 'coupon',
    labels: ['mã giảm', 'ma giam', 'promo', 'coupon', 'voucher', '优惠码', 'クーポン', '쿠폰'],
  },
  {
    kind: 'lead-form',
    labels: ['đăng ký nhận tin', 'nhận tin', 'lead', 'newsletter', '订阅', '最新情報', '소식 받기'],
  },
  {
    kind: 'register',
    pathSegs: ['register', 'signup'],
    labels: ['đăng ký', 'dang ky', 'sign up', 'register', 'signup', '注册', '登録', '가입'],
  },
  {
    kind: 'logout',
    labels: ['đăng xuất', 'dang xuat', 'log out', 'logout', 'sign out', '退出', 'ログアウト', '로그아웃'],
  },
  {
    kind: 'chat',
    labels: ['chat mua', '聊天购买'],
  },
  {
    kind: 'wishlist',
    pathSegs: ['wishlist', 'favorites'],
    labels: ['yêu thích', 'yeu thich', 'wishlist', 'favorite', 'favorites', '收藏', 'お気に入り', '찜'],
  },
  {
    kind: 'favorite-product',
    labels: ['thích sản phẩm', 'like product', '收藏商品'],
  },
  {
    kind: 'notifications',
    pathSegs: ['notifications'],
    labels: ['thông báo', 'thong bao', 'notification', '通知', '알림'],
  },
  {
    kind: 'recently-viewed',
    pathSegs: ['recently-viewed'],
    labels: ['vừa xem', 'vua xem', 'recently viewed', '最近看过', '最近見た', '최근 본'],
  },
  {
    kind: 'order-tracking',
    pathSegs: ['order-tracking'],
    labels: ['theo dõi đơn', 'theo doi don', 'track order', '跟踪订单', '注文を追跡', '주문 추적'],
  },
  {
    kind: 'orders',
    pathSegs: ['orders'],
    labels: ['đơn hàng', 'don hang', 'orders', '订单', '注文', '주문'],
  },
  {
    kind: 'login',
    pathSegs: ['login'],
    lastSegs: ['login'],
    labels: ['đăng nhập', 'dang nhap', 'log in', 'login', '登录', 'ログイン', '로그인'],
  },
  {
    kind: 'try-on',
    labels: ['thử đồ', 'thu do', 'try-on', 'try on', '试穿', '試着', '피팅'],
  },
  {
    kind: 'add-cart',
    labels: ['thêm giỏ', 'them gio', 'add to cart', '加入购物车'],
  },
  {
    kind: 'buy-now',
    labels: ['mua ngay', 'mua hàng', 'buy now', '立即购买'],
  },
  {
    kind: 'cart',
    pathSegs: ['cart'],
    classes: ['pw-cart', 'icon-cart'],
    labels: ['giỏ hàng', 'gio hang', 'cart', '购物车', 'カート', '장바구니'],
  },
  {
    kind: 'contact',
    pathSegs: ['contact', 'lien-he'],
    labels: ['liên hệ', 'lien he', 'contact us', 'contact', '联系我们', '联系', 'お問い合わせ', '문의'],
  },
  {
    kind: 'about',
    pathSegs: ['about'],
    labels: ['về chúng tôi', 've chung toi', 'giới thiệu', 'gioi thieu', 'about us', 'about', '关于我们', '会社概要', '소개'],
  },
  {
    kind: 'faq',
    pathSegs: ['faq'],
    labels: ['hỏi đáp', 'hoi dap', 'câu hỏi', 'cau hoi', 'faq'],
  },
  {
    kind: 'shipping',
    pathSegs: ['shipping'],
    labels: ['vận chuyển', 'van chuyen', 'shipping', '配送', '배송'],
  },
  {
    kind: 'returns',
    pathSegs: ['returns'],
    labels: ['đổi trả', 'doi tra', 'returns', '退换', '返品', '교환'],
  },
  {
    kind: 'payment',
    pathSegs: ['payment'],
    labels: ['thanh toán', 'thanh toan', 'payment', '支付说明', 'お支払い', '결제'],
  },
  {
    kind: 'stores',
    pathSegs: ['stores'],
    labels: ['cửa hàng', 'cua hang', 'stores', '门店', '店舗', '매장'],
  },
  {
    kind: 'lookbook',
    pathSegs: ['lookbook'],
    labels: ['lookbook', 'ルックブック', '룩북'],
  },
  {
    kind: 'size-guide',
    pathSegs: ['size-guide'],
    labels: ['hướng dẫn size', 'huong dan size', 'size guide', '尺码指南', 'サイズガイド', '사이즈 가이드'],
  },
  {
    kind: 'blog',
    pathSegs: ['blog'],
    labels: ['blog', '博客', 'ブログ'],
  },
  {
    kind: 'security',
    pathSegs: ['security'],
    labels: ['bảo mật tài khoản', 'bao mat tai khoan', 'account security'],
  },
  {
    kind: 'privacy',
    pathSegs: ['privacy'],
    labels: ['chính sách bảo mật', 'chinh sach bao mat', 'bảo mật', 'bao mat', 'privacy', '隐私', 'プライバシー', '개인정보'],
  },
  {
    kind: 'terms',
    pathSegs: ['terms'],
    labels: ['điều khoản', 'dieu khoan', 'terms', '条款', '利用規約', '이용약관'],
  },
  {
    kind: 'sale',
    pathSegs: ['sale', 'khuyen-mai'],
    labels: ['khuyến mãi', 'khuyen mai', 'sale', '促销', 'セール', '세일'],
  },
  {
    kind: 'wallet',
    pathSegs: ['wallet'],
    labels: ['ví quà', 'vi qua', 'my vouchers', '优惠券'],
  },
  {
    kind: 'addresses',
    pathSegs: ['addresses'],
    labels: ['sổ địa chỉ', 'so dia chi', 'address book', 'địa chỉ', '地址簿'],
  },
  {
    kind: 'edit-profile',
    pathSegs: ['edit-profile'],
    labels: ['chỉnh sửa hồ sơ', 'chinh sua ho so', 'edit profile', '编辑资料'],
  },
  {
    kind: 'install-app',
    pathSegs: ['install-app'],
    labels: ['cài đặt app', 'cai dat app', 'install app', '安装应用'],
  },
  {
    kind: 'categories',
    labels: ['danh mục', 'danh muc', 'categories', '分类', 'カテゴリ', '카테고리'],
  },
  {
    kind: 'products',
    lastSegs: ['products'],
    labels: ['sản phẩm', 'san pham', 'products', '产品', '製品', '상품'],
  },
  {
    kind: 'home',
    labels: ['trang chủ', 'trang chu', 'home', '홈'],
  },
  {
    kind: 'topup',
    labels: ['lên đầu trang', 'len dau trang', 'lên đầu', 'back to top'],
  },
  {
    kind: 'account',
    lastSegs: ['account'],
    classes: ['pw-account-btn'],
    labels: ['tài khoản', 'tai khoan', 'account', '账户', 'アカウント', '계정'],
  },
]

function norm(raw: unknown): string {
  return String(raw || '')
    .replace(/[0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function lastPathSegment(href: string): string {
  const noHash = href.split('#')[0] || ''
  let path = noHash.split('?')[0] || ''
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  const parts = path.split('/').filter(Boolean)
  return (parts[parts.length - 1] || '').toLowerCase()
}

function queryTab(href: string): string {
  const q = (href.split('#')[0] || '').split('?')[1] || ''
  const m = /(?:^|&)tab=([^&]+)/i.exec(q)
  if (!m) return ''
  try {
    return decodeURIComponent(m[1] || '').toLowerCase()
  } catch {
    return String(m[1] || '').toLowerCase()
  }
}

function pathHas(href: string, seg: string): boolean {
  const last = lastPathSegment(href)
  const tab = queryTab(href)
  const low = href.toLowerCase()
  return last === seg || tab === seg || low.includes(`/${seg}/`) || low.endsWith(`/${seg}`)
}

export function canonChromeWidgetKind(kind: string): string {
  const k = String(kind || '').replace(/[^a-z0-9-]/g, '')
  return CHROME_KIND_ALIASES[k] || k
}

export function inferChromeWidgetKindFromHints(input: ChromeKindHints): string {
  if (input.openChat) return 'chat'
  if (input.tryOn) return 'try-on'
  if (input.favorite) return 'favorite-product'
  if (input.addCart) return 'add-cart'
  if (input.buyNow) return 'buy-now'

  const href = String(input.href || '').trim()
  const hrefLow = href.toLowerCase()
  const cls = norm(input.className)
  const label = norm(input.label)
  const channel = norm(input.contactChannel)

  for (const rule of CHROME_KIND_INFER_RULES) {
    if (rule.channels?.some((c) => channel === c)) return rule.kind
    if (rule.hrefIncludes?.some((bit) => hrefLow.includes(bit))) return rule.kind
    if (rule.pathSegs?.some((seg) => pathHas(hrefLow, seg))) return rule.kind
    if (rule.lastSegs?.some((seg) => lastPathSegment(hrefLow) === seg || queryTab(hrefLow) === seg)) {
      return rule.kind
    }
    if (rule.classes?.some((token) => cls.includes(token))) return rule.kind
    if (rule.labels?.some((bit) => label.includes(bit))) return rule.kind
  }
  return ''
}

/** Chữ / href cụ thể thắng stamp sai (`account` trên Liên hệ, Yêu thích…). Alias giữ stamp gốc. */
export function resolveChromeWidgetKind(stamped: string, inferred: string): string {
  const s = String(stamped || '').replace(/[^a-z0-9-]/g, '')
  const i = String(inferred || '').replace(/[^a-z0-9-]/g, '')
  if (i && s && canonChromeWidgetKind(s) === canonChromeWidgetKind(i)) return s
  if (i) return i
  return s
}

export function resolveChromeWidgetKindFromHints(input: ChromeKindHints): string {
  return resolveChromeWidgetKind(
    String(input.stamped || '').replace(/[^a-z0-9-]/g, ''),
    inferChromeWidgetKindFromHints(input)
  )
}
