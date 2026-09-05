export const PARTNER_MARKETING_BANNER_KINDS = ['sale', 'birthday'] as const
export type PartnerMarketingBannerKind = (typeof PARTNER_MARKETING_BANNER_KINDS)[number]

export const PARTNER_MARKETING_BANNER_ASPECT = '21:9'
export const PARTNER_MARKETING_BANNER_CREDIT_COST = 1.5

export function isPartnerMarketingBannerKind(value: string): value is PartnerMarketingBannerKind {
  return (PARTNER_MARKETING_BANNER_KINDS as readonly string[]).includes(value)
}

export function partnerMarketingBannerPctKey(value: number): string {
  const normalized = `${Number(value).toFixed(2)}`.replace(/\.?0+$/, '')
  return normalized.replace('.', '_')
}

export function partnerMarketingBannerCampaignKey(
  kind: PartnerMarketingBannerKind,
  day: number,
  month: number,
  discountPercent: number
): string {
  return `${kind}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-p${partnerMarketingBannerPctKey(discountPercent)}`
}

export function partnerMarketingBannerDateKey(day: number, month: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parsePartnerMarketingBannerDateKey(raw: string): { day: number; month: number } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (!isValidPartnerMarketingBannerDayMonth(day, month)) return null
  return { day, month }
}

/** Accepts Feb 29 (leap-year probe). Rejects overflow like 31/02. */
export function isValidPartnerMarketingBannerDayMonth(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(2000, month - 1, day)
  return probe.getFullYear() === 2000 && probe.getMonth() === month - 1 && probe.getDate() === day
}

/** Widget attr `sale-calendar` → API/DB kind `sale`. */
export function personalizeBannerToApiKind(
  attr: string | null | undefined
): PartnerMarketingBannerKind | null {
  if (attr === 'birthday') return 'birthday'
  if (attr === 'sale-calendar' || attr === 'sale') return 'sale'
  return null
}

export function displayPartnerMarketingBannerPct(value: number): string {
  return `${Number(value)}%`.replace(/\.0%$/, '%')
}

export type PartnerMarketingBannerCopy = {
  verse: string
  cta: string
  art_direction: string
}

export type PartnerMarketingBannerBrand = {
  shopName: string
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null
  primaryColor: string
  accentColor: string
  buyButtonColor: string
  logoUrl: string | null
}

function fallbackCopy(
  kind: PartnerMarketingBannerKind,
  day: number,
  month: number,
  version: number
): PartnerMarketingBannerCopy {
  const saleOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Ngày đôi ưu đãi - chốt ngay kẻo lỡ', cta: 'SĂN DEAL NGAY', art_direction: 'năng lượng tốc độ, ánh sáng chuyển động' },
    { verse: 'Giá hời đúng hẹn - mua liền hôm nay', cta: `CHỐT DEAL ${day}.${month}`, art_direction: 'sân khấu hiện đại, tương phản mạnh' },
    { verse: 'Một ngày giá tốt - bỏ lỡ tiếc lâu', cta: 'MUA NGAY HÔM NAY', art_direction: 'premium editorial, sản phẩm nổi bật' },
  ]
  const birthdayOptions: PartnerMarketingBannerCopy[] = [
    { verse: 'Tuổi mới an vui - quà riêng trao tay', cta: 'NHẬN QUÀ CỦA TÔI', art_direction: 'ấm áp sang trọng, quà tặng tinh tế' },
    { verse: 'Ngày vui rạng rỡ - quà chờ bạn mở', cta: 'MỞ QUÀ SINH NHẬT', art_direction: 'lễ hội thanh lịch, confetti tối giản' },
    { verse: 'Thêm tuổi thêm duyên - nhận liền quà riêng', cta: 'NHẬN QUÀ NGAY', art_direction: 'mềm mại cao cấp, ánh sáng studio' },
  ]
  const options = kind === 'birthday' ? birthdayOptions : saleOptions
  return options[(day + month + version) % options.length]!
}

export function fallbackPartnerMarketingBannerCopy(input: {
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  version: number
}): PartnerMarketingBannerCopy {
  return fallbackCopy(input.kind, input.day, input.month, input.version)
}

function industryArtHint(industryKey: PartnerMarketingBannerBrand['industryKey']): string {
  if (industryKey === 'hotel') return 'phòng nghỉ, kỳ nghỉ, không gian hospitality cao cấp'
  if (industryKey === 'food') return 'món ăn, bàn tiệc, nguyên liệu tươi'
  if (industryKey === 'other') return 'sản phẩm cửa hàng, đời sống hiện đại'
  return 'thời trang, giày dép, phụ kiện hiện đại'
}

export function buildPartnerMarketingBannerPrompt(input: {
  kind: PartnerMarketingBannerKind
  day: number
  month: number
  discountPercent: number
  brand: PartnerMarketingBannerBrand
  copy?: PartnerMarketingBannerCopy | null
}): string {
  const label = `${String(input.day).padStart(2, '0')}/${String(input.month).padStart(2, '0')}`
  const pct = displayPartnerMarketingBannerPct(input.discountPercent)
  const dynamic = input.copy ?? fallbackCopy(input.kind, input.day, input.month, 1)
  const shop = input.brand.shopName.trim() || 'Shop'
  const shared = [
    'Tạo đúng MỘT banner thương mại điện tử siêu rộng 21:9, chất lượng 2K,',
    'dùng nguyên ảnh trên desktop lẫn mobile, không crop. Phong cách cao cấp,',
    'ấn tượng, chuyển đổi cao.',
    `Màu thương hiệu: primary ${input.brand.primaryColor}, accent ${input.brand.accentColor}, nút ${input.brand.buyButtonColor}.`,
    `Logo chữ tên shop rõ ràng: ${shop}. Chữ tiếng Việt phải lớn, ít, đúng chính tả,`,
    'độ tương phản cao; không thêm mức giảm khác. Không dùng watermark hoặc logo hãng khác.',
    `Chủ đề hình: ${industryArtHint(input.brand.industryKey)}.`,
  ].join(' ')

  if (input.kind === 'sale') {
    return (
      shared +
      ` Bắt buộc ghi nguyên văn: "SALE ${input.day}.${input.month} - GIẢM ${pct}".` +
      ` Ghi nguyên văn câu sáng tác mới: "${dynamic.verse}".` +
      ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
      ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
      ' Tạo cảm giác khẩn cấp. Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
    )
  }
  return (
    shared +
    ` Bắt buộc ghi nguyên văn: "MỪNG SINH NHẬT ${label} - TẶNG ${pct}".` +
    ` Ghi nguyên văn câu thơ mới: "${dynamic.verse}".` +
    ` CTA dạng nút ghi nguyên văn: "${dynamic.cta}".` +
    ` Định hướng mỹ thuật riêng cho phiên bản này: ${dynamic.art_direction}.` +
    ' Không ghi tên khách và không ghi năm sinh. Trang trí quà tặng, bánh sinh nhật,' +
    ' confetti vừa đủ, sang trọng và ấm áp. Đặt toàn bộ chữ quan trọng ở giữa ảnh và đủ lớn để đọc trên điện thoại.'
  )
}

export function partnerMarketingBannerGreeting(locale: string, displayName: string): string {
  const name = displayName.trim() || (locale === 'vi' ? 'Quý khách' : 'you')
  if (locale === 'en') return `A birthday gift just for ${name}`
  if (locale === 'zh') return `专属生日礼物给 ${name}`
  if (locale === 'ja') return `${name} さんへの誕生日ギフト`
  if (locale === 'ko') return `${name} 님을 위한 생일 선물`
  return `Món quà sinh nhật dành riêng cho ${name}`
}

export type PartnerMarketingBannerPublicItem = {
  id: string
  kind: PartnerMarketingBannerKind
  campaign_key: string
  date_key: string
  discount_percent: number
  image_url: string
  aspect_ratio: string
  event_date: string | null
  greeting: string | null
  version: number
  href: string
  is_test?: boolean
  event_label?: string | null
}

export type PartnerMarketingBannerAdminItem = {
  id: string
  kind: PartnerMarketingBannerKind
  campaign_key: string
  date_key: string
  discount_percent: number
  image_url: string | null
  aspect_ratio: string
  image_width: number | null
  image_height: number | null
  prompt: string
  provider: string
  model: string
  status: 'generating' | 'ready' | 'failed'
  error_message: string | null
  version: number
  is_active: boolean
  source: 'ai' | 'upload'
  generated_at: string | null
  created_at: string
}
