import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  getPartnerWebsitePageDef,
  normalizePartnerWebsitePageKey,
  pageCatalogLabels,
} from '@/lib/partner-website/partner-website-page-catalog'

export type PartnerWebsiteSiteType = 'landing' | 'web_shop'

export type PartnerWebsiteStudioStepKey =
  | 'site_type'
  | 'brand_name'
  | 'products_sell'
  | 'value_prop'
  | 'target_audience'
  | 'site_features'
  | 'desktop_header'
  | 'desktop_footer'
  | 'mobile_header'
  | 'mobile_footer'
  | 'style_mood'
  | 'color_palette'
  | 'logo_url'

export type PartnerWebsiteStudioAnswers = Partial<Record<PartnerWebsiteStudioStepKey, string>>

/** Main website interview — brand / features / theme before applying fixed template. */
export const PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS: PartnerWebsiteStudioStepKey[] = [
  'brand_name',
  'logo_url',
  'products_sell',
  'value_prop',
  'target_audience',
  'site_features',
  'style_mood',
  'color_palette',
]

/** Forced for main website studio (landing pages use a separate flow). */
export const PARTNER_WEBSITE_STUDIO_DEFAULT_SITE_TYPE: PartnerWebsiteSiteType = 'web_shop'

export function partnerWebsiteStudioWebShopAnswer(locale: WebLocale): string {
  return (
    PARTNER_WEBSITE_STUDIO_STEP_SUGGESTIONS[locale].site_type?.[1] ||
    PARTNER_WEBSITE_STUDIO_STEP_SUGGESTIONS.en.site_type?.[1] ||
    'Web shop'
  )
}

const STEP_LABELS: Record<WebLocale, Record<PartnerWebsiteStudioStepKey, string>> = {
  vi: {
    site_type: 'Loại web',
    brand_name: 'Tên thương hiệu / shop',
    products_sell: 'Sản phẩm / ngành hàng',
    value_prop: 'Ưu điểm & ưu đãi',
    target_audience: 'Khách hàng mục tiêu',
    site_features: 'Tính năng web cần có',
    desktop_header: 'Header desktop (màn hình chủ)',
    desktop_footer: 'Footer desktop',
    mobile_header: 'Header mobile',
    mobile_footer: 'Footer / thanh nút mobile',
    style_mood: 'Phong cách & giọng văn',
    color_palette: 'Màu sắc chủ đạo',
    logo_url: 'Logo thương hiệu',
  },
  en: {
    site_type: 'Site type',
    brand_name: 'Brand / shop name',
    products_sell: 'Products / industry',
    value_prop: 'Benefits & offers',
    target_audience: 'Target audience',
    site_features: 'Required website features',
    desktop_header: 'Desktop header (home)',
    desktop_footer: 'Desktop footer',
    mobile_header: 'Mobile header',
    mobile_footer: 'Mobile footer / bottom bar',
    style_mood: 'Style & tone',
    color_palette: 'Brand colors',
    logo_url: 'Brand logo',
  },
  zh: {
    site_type: '网站类型',
    brand_name: '品牌 / 店铺名',
    products_sell: '产品 / 行业',
    value_prop: '卖点与优惠',
    target_audience: '目标客户',
    site_features: '网站必备功能',
    desktop_header: '桌面端页头',
    desktop_footer: '桌面端页脚',
    mobile_header: '移动端页头',
    mobile_footer: '移动端底栏按钮',
    style_mood: '风格与语气',
    color_palette: '主色调',
    logo_url: '品牌 Logo',
  },
  ja: {
    site_type: 'サイト種別',
    brand_name: 'ブランド / ショップ名',
    products_sell: '商品 / 業種',
    value_prop: '強みとオファー',
    target_audience: 'ターゲット',
    site_features: '必要なWeb機能',
    desktop_header: 'デスクトップヘッダー',
    desktop_footer: 'デスクトップフッター',
    mobile_header: 'モバイルヘッダー',
    mobile_footer: 'モバイル下部ボタン',
    style_mood: 'スタイル',
    color_palette: 'カラー',
    logo_url: 'ブランドロゴ',
  },
  ko: {
    site_type: '사이트 유형',
    brand_name: '브랜드 / 샵 이름',
    products_sell: '상품 / 업종',
    value_prop: '장점 및 혜택',
    target_audience: '타깃 고객',
    site_features: '필수 웹 기능',
    desktop_header: '데스크톱 헤더',
    desktop_footer: '데스크톱 푸터',
    mobile_header: '모바일 헤더',
    mobile_footer: '모바일 하단 버튼',
    style_mood: '스타일',
    color_palette: '브랜드 컬러',
    logo_url: '브랜드 로고',
  },
}

export const PARTNER_WEBSITE_STUDIO_STEP_SUGGESTIONS: Record<
  WebLocale,
  Partial<Record<PartnerWebsiteStudioStepKey, string[]>>
> = {
  vi: {
    site_type: ['Landing một trang', 'Web shop nhiều trang'],
    brand_name: ['Luna Fashion', 'Green Home Decor', 'Bé Yêu Kids'],
    products_sell: ['Thời trang nữ', 'Mỹ phẩm organic', 'Đồ gia dụng thông minh'],
    value_prop: ['Freeship đơn từ 299k', 'Đổi trả 7 ngày', 'Chat mua nhanh qua Zalo'],
    target_audience: ['Nữ 25–35, thích tối giản', 'Mẹ bỉm 28–40', 'Gen Z thích streetwear'],
    site_features: [
      'Trang chủ, danh sách SP, chi tiết SP, giỏ hàng, đặt hàng, chat tư vấn, tìm kiếm',
      'Catalog + giỏ + chat + yêu thích + vừa xem',
      'Hero khuyến mãi, grid SP, FAQ, form liên hệ, chat',
    ],
    desktop_header: [
      'Logo trái — menu: Trang chủ, Sản phẩm, Ưu đãi — Giỏ hàng + Chat phải',
      'Logo — danh mục dropdown — tìm kiếm — giỏ — đăng nhập',
      'Logo — menu ngang — nút Chat mua ngay',
    ],
    desktop_footer: [
      'Cột: Về shop, Chính sách, Liên hệ — SĐT/Zalo — mạng xã hội — copyright',
      'Links: Sản phẩm, Đổi trả, Vận chuyển — hotline — bản đồ',
      'Newsletter + link chính sách + copyright',
    ],
    mobile_header: [
      'Hamburger trái — Logo giữa — Giỏ phải',
      'Logo trái — icon tìm kiếm + giỏ phải',
      'Logo — nút Chat nhỏ — icon giỏ',
    ],
    mobile_footer: [
      'Thanh dưới: Trang chủ | Sản phẩm | Chat | Giỏ | Tài khoản',
      'Trang chủ | Ưu đãi | Chat | Giỏ',
      'Chỉ nút Chat nổi + giỏ trên header (không bottom bar)',
    ],
    style_mood: ['Tối giản, sang trọng', 'Trẻ trung, năng động', 'Ấm áp, thân thiện'],
    color_palette: ['Beige + đen', 'Hồng pastel + trắng', 'Xanh navy + vàng gold'],
    logo_url: [],
  },
  en: {
    site_type: ['Single-page landing', 'Multi-page shop site'],
    brand_name: ['Luna Fashion', 'Green Home Decor', 'Little Joy Kids'],
    products_sell: ["Women's fashion", 'Organic skincare', 'Smart home goods'],
    value_prop: ['Free shipping over $50', '7-day returns', 'Chat to buy instantly'],
    target_audience: ['Women 25–35, minimalist taste', 'Parents 28–40', 'Gen Z streetwear fans'],
    site_features: [
      'Home, product list, product detail, cart, checkout, consult chat, search',
      'Catalog + cart + chat + favorites + recently viewed',
      'Promo hero, product grid, FAQ, contact form, chat',
    ],
    desktop_header: [
      'Logo left — nav: Home, Products, Offers — Cart + Chat right',
      'Logo — category dropdown — search — cart — sign in',
      'Logo — horizontal menu — Chat to buy CTA',
    ],
    desktop_footer: [
      'Columns: About, Policies, Contact — phone — social — copyright',
      'Links: Products, Returns, Shipping — hotline — map',
      'Newsletter + policy links + copyright',
    ],
    mobile_header: [
      'Hamburger left — Logo center — Cart right',
      'Logo left — search + cart icons right',
      'Logo — small Chat — cart icon',
    ],
    mobile_footer: [
      'Bottom bar: Home | Products | Chat | Cart | Account',
      'Home | Offers | Chat | Cart',
      'Floating chat only + cart in header (no bottom bar)',
    ],
    style_mood: ['Minimal, premium', 'Youthful, energetic', 'Warm, friendly'],
    color_palette: ['Beige + black', 'Soft pink + white', 'Navy + gold'],
    logo_url: [],
  },
  zh: {
    site_type: ['单页落地页', '多页店铺网站'],
    brand_name: ['Luna 时尚', '绿居家居', '宝贝童装'],
    products_sell: ['女装', '有机护肤', '智能家居'],
    value_prop: ['满299包邮', '7天退换', '即时聊天购买'],
    target_audience: ['25–35岁简约风女性', '28–40岁宝妈', 'Z世代街头风'],
    site_features: [
      '首页、商品列表、详情、购物车、下单、咨询聊天、搜索',
      '目录+购物车+聊天+收藏+最近浏览',
      '促销主视觉、商品网格、FAQ、联系表单、聊天',
    ],
    desktop_header: [
      '左侧Logo — 导航：首页/商品/优惠 — 右侧购物车+聊天',
      'Logo — 分类下拉 — 搜索 — 购物车 — 登录',
      'Logo — 横向菜单 — 立即聊天购买',
    ],
    desktop_footer: [
      '关于/政策/联系 — 电话 — 社交 — 版权',
      '商品/退换/配送 — 热线 — 地图',
      '订阅+政策链接+版权',
    ],
    mobile_header: [
      '左汉堡 — 中Logo — 右购物车',
      '左Logo — 右搜索+购物车',
      'Logo — 小聊天 — 购物车',
    ],
    mobile_footer: [
      '底栏：首页|商品|聊天|购物车|账户',
      '首页|优惠|聊天|购物车',
      '仅悬浮聊天+顶栏购物车（无底栏）',
    ],
    style_mood: ['简约高级', '年轻活力', '温暖亲切'],
    color_palette: ['米色+黑', '粉 pastel+白', '深蓝+金'],
    logo_url: [],
  },
  ja: {
    site_type: ['1ページLP', '複数ページショップ'],
    brand_name: ['Luna Fashion', 'Green Home', 'ベビージョイ'],
    products_sell: ['レディースファッション', 'オーガニックコスメ', 'スマートホーム'],
    value_prop: ['2990円以上送料無料', '7日返品', 'チャット即購入'],
    target_audience: ['25–35歳ミニマル好き', '28–40歳ママ', 'Z世代ストリート'],
    site_features: [
      'ホーム、商品一覧、詳細、カート、注文、相談チャット、検索',
      'カタログ+カート+チャット+お気に入り+閲覧履歴',
      'ヒーロー、商品グリッド、FAQ、お問い合わせ、チャット',
    ],
    desktop_header: [
      '左ロゴ — ナビ：ホーム/商品/お得 — 右カート+チャット',
      'ロゴ — カテゴリ — 検索 — カート — ログイン',
      'ロゴ — 横メニュー — チャット購入CTA',
    ],
    desktop_footer: [
      '会社情報/ポリシー/連絡先 — 電話 — SNS — 著作権',
      '商品/返品/配送 — ホットライン — 地図',
      'ニュースレター+ポリシー+著作権',
    ],
    mobile_header: [
      '左ハンバーガー — 中央ロゴ — 右カート',
      '左ロゴ — 右検索+カート',
      'ロゴ — 小チャット — カート',
    ],
    mobile_footer: [
      '下部：ホーム|商品|チャット|カート|アカウント',
      'ホーム|お得|チャット|カート',
      'フローティングチャットのみ+ヘッダーカート',
    ],
    style_mood: ['ミニマル・高級感', '若々しく活発', '温かみのある'],
    color_palette: ['ベージュ+黒', 'パステルピンク+白', 'ネイビー+ゴールド'],
    logo_url: [],
  },
  ko: {
    site_type: ['단일 랜딩', '다중 페이지 샵'],
    brand_name: ['Luna Fashion', 'Green Home', 'Little Joy'],
    products_sell: ['여성 패션', '오가닉 스킨케어', '스마트 홈'],
    value_prop: ['3만원 이상 무료배송', '7일 교환', '채팅 즉시 구매'],
    target_audience: ['25–35 미니멀 여성', '28–40 엄마', 'Z세대 스트릿'],
    site_features: [
      '홈, 상품 목록, 상세, 장바구니, 주문, 상담 채팅, 검색',
      '카탈로그+장바구니+채팅+찜+최근 본 상품',
      '프로모 히어로, 상품 그리드, FAQ, 문의 폼, 채팅',
    ],
    desktop_header: [
      '왼쪽 로고 — 메뉴: 홈/상품/혜택 — 오른쪽 장바구니+채팅',
      '로고 — 카테고리 — 검색 — 장바구니 — 로그인',
      '로고 — 가로 메뉴 — 채팅 구매 CTA',
    ],
    desktop_footer: [
      '소개/정책/연락처 — 전화 — SNS — 저작권',
      '상품/교환/배송 — 핫라인 — 지도',
      '뉴스레터+정책 링크+저작권',
    ],
    mobile_header: [
      '왼쪽 햄버거 — 가운데 로고 — 오른쪽 장바구니',
      '왼쪽 로고 — 오른쪽 검색+장바구니',
      '로고 — 작은 채팅 — 장바구니',
    ],
    mobile_footer: [
      '하단: 홈|상품|채팅|장바구니|계정',
      '홈|혜택|채팅|장바구니',
      '플로팅 채팅만+헤더 장바구니(하단바 없음)',
    ],
    style_mood: ['미니멀 프리미엄', '젊고 활기찬', '따뜻하고 친근한'],
    color_palette: ['베이지+블랙', '파스텔 핑크+화이트', '네이비+골드'],
    logo_url: [],
  },
}

export function studioStepLabel(locale: WebLocale, key: PartnerWebsiteStudioStepKey): string {
  return STEP_LABELS[locale][key] ?? STEP_LABELS.en[key]
}

export function studioStepQuestionText(
  stepKey: PartnerWebsiteStudioStepKey,
  questionTexts: Record<string, string>
): string {
  const map: Record<PartnerWebsiteStudioStepKey, string> = {
    site_type: questionTexts.studioQ_site_type ?? '',
    brand_name: questionTexts.studioQ_brand_name ?? '',
    products_sell: questionTexts.studioQ_products_sell ?? '',
    value_prop: questionTexts.studioQ_value_prop ?? '',
    target_audience: questionTexts.studioQ_target_audience ?? '',
    site_features: questionTexts.studioQ_site_features ?? '',
    desktop_header: questionTexts.studioQ_desktop_header ?? '',
    desktop_footer: questionTexts.studioQ_desktop_footer ?? '',
    mobile_header: questionTexts.studioQ_mobile_header ?? '',
    mobile_footer: questionTexts.studioQ_mobile_footer ?? '',
    style_mood: questionTexts.studioQ_style_mood ?? '',
    color_palette: questionTexts.studioQ_color_palette ?? '',
    logo_url: questionTexts.studioQ_logo_url ?? '',
  }
  return map[stepKey] || studioStepLabel('vi', stepKey)
}

export function studioStepSuggestions(locale: WebLocale, key: PartnerWebsiteStudioStepKey): string[] {
  return PARTNER_WEBSITE_STUDIO_STEP_SUGGESTIONS[locale][key] ?? PARTNER_WEBSITE_STUDIO_STEP_SUGGESTIONS.en[key] ?? []
}

export function resolvePartnerWebsiteSiteType(_raw: string | undefined): PartnerWebsiteSiteType {
  return PARTNER_WEBSITE_STUDIO_DEFAULT_SITE_TYPE
}

export function buildPartnerWebsiteStudioBrief(
  answers: PartnerWebsiteStudioAnswers,
  locale: WebLocale
): string {
  const labels = STEP_LABELS[locale]
  const lines: string[] = []
  for (const key of PARTNER_WEBSITE_STUDIO_DISCOVERY_KEYS) {
    if (key === 'logo_url') continue
    const value = answers[key]?.trim()
    if (value) lines.push(`${labels[key]}: ${value}`)
  }
  lines.unshift(
    locale === 'vi'
      ? 'Loại web: Web chính (trang chủ + catalog + giỏ hàng)'
      : 'Site type: Main shop website (home + catalog + cart)'
  )
  return lines.join('\n')
}

function answersToHubSession(answers: PartnerWebsiteStudioAnswers): HubStudioSession {
  const brand = answers.brand_name?.trim() || 'Shop'
  return {
    presetId: 'landing_page',
    projectTitle: brand,
    uploadImages: [],
    briefNotes: {
      product_name: brand,
      value_prop: answers.value_prop?.trim() || '',
      target_audience: answers.target_audience?.trim() || '',
      style_mood: answers.style_mood?.trim() || '',
      color_palette: answers.color_palette?.trim() || '',
      products_sell: answers.products_sell?.trim() || '',
    },
    discoveryComplete: true,
    processSteps: [],
    currentStepKey: null,
    referenceImages: [],
    pendingPreview: null,
    lastGenerationPrompt: null,
  }
}

/** One mockup image must show full desktop UI + full mobile UI side by side for the selected page. */
export function buildPartnerWebsiteMockupPrompt(input: {
  locale: WebLocale
  answers: PartnerWebsiteStudioAnswers
  revisionNote?: string
  pageKey?: string
  /** Approved/home mockup URL — non-home pages must match this visual system. */
  styleReferenceMockupUrl?: string
}): { prompt: string; kind: 'ui_mockup' | 'ui_desktop'; aspectRatio: string; screenLabel: string } {
  const pageKey = normalizePartnerWebsitePageKey(input.pageKey)
  const pageDef = getPartnerWebsitePageDef(pageKey)
  const labels = pageCatalogLabels(input.locale)
  const pageTitle = labels[pageKey].title
  const session = answersToHubSession(input.answers)
  const brief = buildPartnerWebsiteStudioBrief(input.answers, input.locale)
  const features = input.answers.site_features?.trim() || labels[pageKey].hint
  const deskHeader = input.answers.desktop_header?.trim() || 'Logo, nav, cart, chat'
  const deskFooter = input.answers.desktop_footer?.trim() || 'Links, contact, copyright'
  const mobHeader = input.answers.mobile_header?.trim() || 'Hamburger, logo, cart'
  const mobFooter = input.answers.mobile_footer?.trim() || 'Home | Products | Chat | Cart'
  const styleMood = input.answers.style_mood?.trim() || 'Match existing shop homepage'
  const colorPalette = input.answers.color_palette?.trim() || 'Same brand colors as homepage'

  const appendRevision = (prompt: string) => {
    const note = input.revisionNote?.trim()
    if (!note) return prompt
    return `${prompt}\n\n---\nRevision instructions for this regeneration:\n${note}`
  }

  const designSystemLock = `DESIGN SYSTEM LOCK (mandatory for every page):
- Visual identity MUST match the shop HOMEPAGE: same colors, typography, button styles, spacing, logo treatment, header & footer chrome.
- Style mood: ${styleMood}
- Color palette: ${colorPalette}
- Do NOT invent a new brand look for this page.
- Desktop and mobile frames must share the exact same design system.`

  const pageChrome = `DESKTOP HEADER (must match homepage):\n${deskHeader}\n\nDESKTOP FOOTER (must match homepage):\n${deskFooter}\n\nMOBILE HEADER (must match homepage):\n${mobHeader}\n\nMOBILE FOOTER / BOTTOM BUTTONS (must match homepage):\n${mobFooter}`

  const styleRef = input.styleReferenceMockupUrl?.trim()
  const styleRefNote =
    pageKey !== 'home' && styleRef
      ? `\nSTYLE REFERENCE (homepage mockup — match this look exactly):\n${styleRef}\n`
      : ''

  const prompt = appendRevision(`Create ONE single high-fidelity UI mockup image that shows BOTH devices together for ONE shop page.

PAGE TO DESIGN: ${pageTitle} (${pageKey})
HTML file target: ${pageDef?.htmlPath ?? 'index.html'}
Route: ${pageDef?.routePath ?? '/'}

LAYOUT OF THE IMAGE (mandatory):
- Landscape canvas (widescreen).
- LEFT ~60%: a desktop browser window showing the FULL ${pageTitle} page UI.
- RIGHT ~40%: a smartphone frame showing the SAME ${pageTitle} page adapted for mobile.
- Same brand colors, logo, typography, and visual style on both devices.
- Readable UI text (not lorem). No separate second image — everything in this one frame.

Project / brand: ${session.projectTitle}

${designSystemLock}
${styleRefNote}
CUSTOMER BRIEF:
${brief}

REQUIRED FEATURES FOR THIS PAGE (content/layout only — keep homepage look):
${features}

${pageChrome}

Modern ecommerce shop UI. Single finished presentation mockup only.`)

  return {
    kind: 'ui_desktop',
    aspectRatio: '16:9',
    screenLabel: `Desktop + mobile — ${pageTitle}`,
    prompt,
  }
}

export function buildPartnerWebsiteStudioBuildMessage(input: {
  locale: WebLocale
  answers: PartnerWebsiteStudioAnswers
  approvedMockupUrl: string
  pageKey?: string
}): string {
  const pageKey = normalizePartnerWebsitePageKey(input.pageKey)
  const pageDef = getPartnerWebsitePageDef(pageKey)
  const labels = pageCatalogLabels(input.locale)
  const brief = buildPartnerWebsiteStudioBrief(input.answers, input.locale)
  const htmlPath = pageDef?.htmlPath ?? 'index.html'
  const intro =
    input.locale === 'vi'
      ? `Dựng TRANG「${labels[pageKey].title}」(${pageKey}) thành file ${htmlPath}. Mockup desktop + mobile. Responsive. KHÔNG dùng template mặc định.`
      : `Build the「${labels[pageKey].title}」page (${pageKey}) as ${htmlPath}. Desktop + mobile mockup. Fully responsive. No default template.`
  const designLock =
    input.locale === 'vi'
      ? `KHÓA GIAO DIỆN (bắt buộc):
- Trang này PHẢI dùng cùng hệ màu / font / nút / header / footer với TRANG CHỦ (index.html + css/main.css hiện có).
- Style: ${input.answers.style_mood || 'theo trang chủ'}
- Màu: ${input.answers.color_palette || 'theo trang chủ'}
- Với trang không phải home: GIỮ NGUYÊN css/main.css hiện có — chỉ sinh/ cập nhật ${htmlPath}; không invent palette mới.
- Header/footer HTML phải cùng cấu trúc & class với trang chủ.`
      : `DESIGN LOCK (mandatory):
- This page MUST reuse the homepage design system (same colors, fonts, buttons, header, footer as index.html + existing css/main.css).
- Style: ${input.answers.style_mood || 'match homepage'}
- Colors: ${input.answers.color_palette || 'match homepage'}
- For non-home pages: KEEP existing css/main.css — only create/update ${htmlPath}; do not invent a new palette.
- Header/footer markup must mirror the homepage structure & classes.`
  const chromeNote =
    input.locale === 'vi'
      ? `Trang: ${pageKey}\nFile: ${htmlPath}\nTính năng: ${input.answers.site_features || '—'}\nHeader desktop: ${input.answers.desktop_header || '—'}\nFooter desktop: ${input.answers.desktop_footer || '—'}\nHeader mobile: ${input.answers.mobile_header || '—'}\nFooter/nút mobile: ${input.answers.mobile_footer || '—'}`
      : `Page: ${pageKey}\nFile: ${htmlPath}\nFeatures: ${input.answers.site_features || '—'}\nDesktop header: ${input.answers.desktop_header || '—'}\nDesktop footer: ${input.answers.desktop_footer || '—'}\nMobile header: ${input.answers.mobile_header || '—'}\nMobile footer: ${input.answers.mobile_footer || '—'}`
  return `${intro}\n\n${designLock}\n\n${chromeNote}\n\nDesign mockup URL: ${input.approvedMockupUrl}\n\nBrief:\n${brief}\n\nReturn project files; set entryPath to ${htmlPath}. Prefer linking shared css/main.css. Keep other existing HTML pages.`
}
