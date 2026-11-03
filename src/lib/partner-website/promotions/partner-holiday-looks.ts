import type { WebLocale } from '@/lib/i18n/config'
import {
  PARTNER_HOLIDAY_THEME_IDS,
  type PartnerHolidayThemeId,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'

export type PartnerHolidayLookCopy = {
  ribbonTitle: string
  ribbonBody: string
  preview: string
  kicker: string
}

export type PartnerHolidayLook = {
  id: PartnerHolidayThemeId
  strong: string
  deep: string
  mid: string
  gold: string
  goldSoft: string
  paper: string
  ink: string
  dark: string
  themeColor: string
  copy: Record<WebLocale, PartnerHolidayLookCopy>
}

function allCopy(
  vi: PartnerHolidayLookCopy,
  en: PartnerHolidayLookCopy,
  zh: PartnerHolidayLookCopy,
  ja: PartnerHolidayLookCopy,
  ko: PartnerHolidayLookCopy
): Record<WebLocale, PartnerHolidayLookCopy> {
  return { vi, en, zh, ja, ko }
}

function look(
  id: PartnerHolidayThemeId,
  colors: Omit<PartnerHolidayLook, 'id' | 'copy'>,
  copy: Record<WebLocale, PartnerHolidayLookCopy>
): PartnerHolidayLook {
  return { id, ...colors, copy }
}

const LOOKS: PartnerHolidayLook[] = [
  look(
    'duong-lich',
    {
      strong: '#1e3a5f',
      deep: '#0f2744',
      mid: '#3d6b99',
      gold: '#e7c36a',
      goldSoft: '#f6d589',
      paper: '#f4f7fb',
      ink: '#1e3a5f',
      dark: '#0b1c33',
      themeColor: '#0f2744',
    },
    allCopy(
      { ribbonTitle: 'Năm mới', ribbonBody: 'Chúc một năm mới bình an', preview: 'Đang xem trước Tết Dương lịch.', kicker: 'Tết Dương lịch' },
      { ribbonTitle: 'New Year', ribbonBody: 'Wishing you a peaceful new year', preview: 'Previewing Solar New Year.', kicker: 'Solar New Year' },
      { ribbonTitle: '元旦', ribbonBody: '祝新年平安', preview: '正在预览元旦界面。', kicker: '元旦' },
      { ribbonTitle: '新年', ribbonBody: '新しい一年の平安を', preview: '太陽暦の正月をプレビュー中。', kicker: '元日' },
      { ribbonTitle: '새해', ribbonBody: '평안한 새해를 기원합니다', preview: '양력 설 미리보기 중.', kicker: '양력 설' }
    )
  ),
  look(
    'tao-quan',
    {
      strong: '#c2410c',
      deep: '#9a3412',
      mid: '#ea580c',
      gold: '#f6d589',
      goldSoft: '#ffedd5',
      paper: '#fff7ed',
      ink: '#9a3412',
      dark: '#7c2d12',
      themeColor: '#9a3412',
    },
    allCopy(
      { ribbonTitle: 'Đưa Táo về trời', ribbonBody: '23 tháng Chạp', preview: 'Đang xem trước Ông Công Ông Táo.', kicker: 'Ông Công Ông Táo' },
      { ribbonTitle: 'Kitchen Gods', ribbonBody: '23rd of the lunar 12th month', preview: 'Previewing Kitchen Gods Day.', kicker: 'Kitchen Gods' },
      { ribbonTitle: '送灶', ribbonBody: '农历十二月廿三', preview: '正在预览祭灶界面。', kicker: '祭灶' },
      { ribbonTitle: '竈君', ribbonBody: '旧暦12月23日', preview: '竈君の日をプレビュー中。', kicker: '竈君' },
      { ribbonTitle: '조왕신', ribbonBody: '음력 12월 23일', preview: '조왕신 날 미리보기 중.', kicker: '조왕신' }
    )
  ),
  look(
    'tet',
    {
      strong: '#b4233a',
      deep: '#8e1530',
      mid: '#c44758',
      gold: '#e7c36a',
      goldSoft: '#f6d589',
      paper: '#fff6ee',
      ink: '#9f1239',
      dark: '#7a1228',
      themeColor: '#8e1530',
    },
    allCopy(
      { ribbonTitle: 'Tết đang về', ribbonBody: 'Mai đào khoe sắc, sắm Tết an khang', preview: 'Đang xem trước giao diện Tết.', kicker: 'Mùa Tết Nguyên Đán' },
      { ribbonTitle: 'Tet is coming', ribbonBody: 'Peach blossoms and lucky red envelopes', preview: 'Previewing Tet theme.', kicker: 'Lunar New Year' },
      { ribbonTitle: '春节将至', ribbonBody: '桃花梅花，安康过年', preview: '正在预览春节界面。', kicker: '春节' },
      { ribbonTitle: 'テト到来', ribbonBody: '桃と梅、安康な新年を', preview: 'テトテーマをプレビュー中。', kicker: '旧正月' },
      { ribbonTitle: '뗏이 다가옵니다', ribbonBody: '복숭아꽃과 행운의 세뱃돈', preview: '뗏 테마 미리보기 중.', kicker: '음력 설' }
    )
  ),
  look(
    'valentine',
    {
      strong: '#9f1239',
      deep: '#881337',
      mid: '#be123c',
      gold: '#fecdd3',
      goldSoft: '#ffe4e6',
      paper: '#fff1f2',
      ink: '#9f1239',
      dark: '#4c0519',
      themeColor: '#881337',
    },
    allCopy(
      { ribbonTitle: 'Mùa yêu', ribbonBody: '14/2 — chọn quà, giao tận nơi', preview: 'Đang xem trước Valentine.', kicker: 'Valentine' },
      { ribbonTitle: 'Season of love', ribbonBody: 'Feb 14 — pick a gift, delivered', preview: 'Previewing Valentine.', kicker: 'Valentine' },
      { ribbonTitle: '情人节', ribbonBody: '2月14日 — 选礼物送达', preview: '正在预览情人节界面。', kicker: '情人节' },
      { ribbonTitle: 'バレンタイン', ribbonBody: '2月14日 — ギフトをお届け', preview: 'バレンタインをプレビュー中。', kicker: 'バレンタイン' },
      { ribbonTitle: '발렌타인', ribbonBody: '2월 14일 — 선물 선택, 배송', preview: '발렌타인 미리보기 중.', kicker: '발렌타인' }
    )
  ),
  look(
    'nguyen-tieu',
    {
      strong: '#b45309',
      deep: '#92400e',
      mid: '#d97706',
      gold: '#fde68a',
      goldSoft: '#fef3c7',
      paper: '#fffbeb',
      ink: '#92400e',
      dark: '#78350f',
      themeColor: '#92400e',
    },
    allCopy(
      { ribbonTitle: 'Rằm tháng Giêng', ribbonBody: 'Tết Nguyên Tiêu', preview: 'Đang xem trước Tết Nguyên Tiêu.', kicker: 'Nguyên Tiêu' },
      { ribbonTitle: 'Lantern Festival', ribbonBody: 'First full moon of the year', preview: 'Previewing Lantern Festival.', kicker: 'Lantern Festival' },
      { ribbonTitle: '元宵', ribbonBody: '正月十五', preview: '正在预览元宵界面。', kicker: '元宵' },
      { ribbonTitle: '元宵節', ribbonBody: '旧暦1月15日', preview: '元宵節をプレビュー中。', kicker: '元宵' },
      { ribbonTitle: '원소절', ribbonBody: '정월 대보름', preview: '원소절 미리보기 중.', kicker: '원소절' }
    )
  ),
  look(
    'phu-nu-83',
    {
      strong: '#be185d',
      deep: '#9d174d',
      mid: '#db2777',
      gold: '#fbcfe8',
      goldSoft: '#fce7f3',
      paper: '#fdf2f8',
      ink: '#9d174d',
      dark: '#831843',
      themeColor: '#9d174d',
    },
    allCopy(
      { ribbonTitle: '8/3', ribbonBody: 'Chúc mừng phụ nữ', preview: 'Đang xem trước 8/3.', kicker: 'Quốc tế Phụ nữ' },
      { ribbonTitle: 'March 8', ribbonBody: 'Celebrating women', preview: 'Previewing International Women’s Day.', kicker: 'Women’s Day' },
      { ribbonTitle: '3月8日', ribbonBody: '祝贺女性', preview: '正在预览三八妇女节界面。', kicker: '妇女节' },
      { ribbonTitle: '3月8日', ribbonBody: '女性に祝福を', preview: '国際女性デーをプレビュー中。', kicker: '女性デー' },
      { ribbonTitle: '3월 8일', ribbonBody: '여성을 축하합니다', preview: '세계 여성의 날 미리보기 중.', kicker: '여성의 날' }
    )
  ),
  look(
    'gio-to',
    {
      strong: '#a16207',
      deep: '#854d0e',
      mid: '#ca8a04',
      gold: '#fde68a',
      goldSoft: '#fef9c3',
      paper: '#fefce8',
      ink: '#854d0e',
      dark: '#713f12',
      themeColor: '#854d0e',
    },
    allCopy(
      { ribbonTitle: 'Giỗ Tổ', ribbonBody: 'Nhớ nguồn, sắm đồ mới', preview: 'Đang xem trước Giỗ Tổ.', kicker: 'Giỗ Tổ Hùng Vương' },
      { ribbonTitle: 'Hung Kings', ribbonBody: 'Remembering our roots', preview: 'Previewing Hung Kings Commemoration.', kicker: 'Hung Kings' },
      { ribbonTitle: '雄王祭', ribbonBody: '饮水思源', preview: '正在预览雄王祭界面。', kicker: '雄王祭' },
      { ribbonTitle: '雄王祭り', ribbonBody: 'ルーツを偲ぶ', preview: '雄王記念日をプレビュー中。', kicker: '雄王' },
      { ribbonTitle: '훙브엉 제사', ribbonBody: '뿌리를 기립니다', preview: '훙브엉 제사 미리보기 중.', kicker: '훙브엉' }
    )
  ),
  look(
    'dai-le',
    {
      strong: '#b91c1c',
      deep: '#991b1b',
      mid: '#dc2626',
      gold: '#fde047',
      goldSoft: '#fef9c3',
      paper: '#fef2f2',
      ink: '#991b1b',
      dark: '#7f1d1d',
      themeColor: '#991b1b',
    },
    allCopy(
      { ribbonTitle: 'Đại lễ', ribbonBody: '30/4 và 1/5', preview: 'Đang xem trước 30/4 và 1/5.', kicker: '30/4 – 1/5' },
      { ribbonTitle: 'Reunification', ribbonBody: 'April 30 and May 1', preview: 'Previewing Reunification holidays.', kicker: 'Apr 30 – May 1' },
      { ribbonTitle: '大假', ribbonBody: '4月30日与5月1日', preview: '正在预览四五一界面。', kicker: '4/30–5/1' },
      { ribbonTitle: '大型連休', ribbonBody: '4月30日と5月1日', preview: '4/30・5/1をプレビュー中。', kicker: '4/30–5/1' },
      { ribbonTitle: '연휴', ribbonBody: '4월 30일과 5월 1일', preview: '4/30·5/1 미리보기 중.', kicker: '4/30–5/1' }
    )
  ),
  look(
    'thieu-nhi',
    {
      strong: '#0369a1',
      deep: '#075985',
      mid: '#0284c7',
      gold: '#fde68a',
      goldSoft: '#e0f2fe',
      paper: '#f0f9ff',
      ink: '#075985',
      dark: '#0c4a6e',
      themeColor: '#075985',
    },
    allCopy(
      { ribbonTitle: '1/6', ribbonBody: 'Quốc tế Thiếu nhi', preview: 'Đang xem trước 1/6.', kicker: 'Thiếu nhi' },
      { ribbonTitle: 'June 1', ribbonBody: 'International Children’s Day', preview: 'Previewing Children’s Day.', kicker: 'Children’s Day' },
      { ribbonTitle: '6月1日', ribbonBody: '国际儿童节', preview: '正在预览儿童节界面。', kicker: '儿童节' },
      { ribbonTitle: '6月1日', ribbonBody: '国際子供の日', preview: '子供の日をプレビュー中。', kicker: '子供の日' },
      { ribbonTitle: '6월 1일', ribbonBody: '세계 어린이날', preview: '어린이날 미리보기 중.', kicker: '어린이날' }
    )
  ),
  look(
    'doan-ngo',
    {
      strong: '#15803d',
      deep: '#166534',
      mid: '#16a34a',
      gold: '#fde68a',
      goldSoft: '#dcfce7',
      paper: '#f0fdf4',
      ink: '#166534',
      dark: '#14532d',
      themeColor: '#166534',
    },
    allCopy(
      { ribbonTitle: 'Đoan Ngọ', ribbonBody: '5 tháng 5 âm lịch', preview: 'Đang xem trước Đoan Ngọ.', kicker: 'Tết Đoan Ngọ' },
      { ribbonTitle: 'Dragon Boat', ribbonBody: '5th day of the 5th lunar month', preview: 'Previewing Dragon Boat Festival.', kicker: 'Dragon Boat' },
      { ribbonTitle: '端午', ribbonBody: '农历五月初五', preview: '正在预览端午界面。', kicker: '端午' },
      { ribbonTitle: '端午', ribbonBody: '旧暦5月5日', preview: '端午をプレビュー中。', kicker: '端午' },
      { ribbonTitle: '단오', ribbonBody: '음력 5월 5일', preview: '단오 미리보기 중.', kicker: '단오' }
    )
  ),
  look(
    'vu-lan',
    {
      strong: '#7c3aed',
      deep: '#6d28d9',
      mid: '#8b5cf6',
      gold: '#fbcfe8',
      goldSoft: '#ede9fe',
      paper: '#f5f3ff',
      ink: '#6d28d9',
      dark: '#4c1d95',
      themeColor: '#6d28d9',
    },
    allCopy(
      { ribbonTitle: 'Vu Lan', ribbonBody: 'Báo hiếu mùa rằm tháng Bảy', preview: 'Đang xem trước Vu Lan.', kicker: 'Lễ Vu Lan' },
      { ribbonTitle: 'Vu Lan', ribbonBody: 'Filial piety on the 7th full moon', preview: 'Previewing Vu Lan.', kicker: 'Vu Lan' },
      { ribbonTitle: '盂兰', ribbonBody: '七月十五报恩', preview: '正在预览盂兰界面。', kicker: '盂兰' },
      { ribbonTitle: '盂蘭', ribbonBody: '旧暦7月15日', preview: '盂蘭をプレビュー中。', kicker: '盂蘭' },
      { ribbonTitle: '우란', ribbonBody: '음력 7월 보름', preview: '우란 미리보기 중.', kicker: '우란' }
    )
  ),
  look(
    'quoc-khanh',
    {
      strong: '#b91c1c',
      deep: '#7f1d1d',
      mid: '#dc2626',
      gold: '#facc15',
      goldSoft: '#fef9c3',
      paper: '#fef2f2',
      ink: '#7f1d1d',
      dark: '#450a0a',
      themeColor: '#7f1d1d',
    },
    allCopy(
      { ribbonTitle: 'Quốc khánh', ribbonBody: '2/9', preview: 'Đang xem trước Quốc khánh.', kicker: 'Quốc khánh' },
      { ribbonTitle: 'National Day', ribbonBody: 'September 2', preview: 'Previewing National Day.', kicker: 'National Day' },
      { ribbonTitle: '国庆', ribbonBody: '9月2日', preview: '正在预览国庆界面。', kicker: '国庆' },
      { ribbonTitle: '建国記念日', ribbonBody: '9月2日', preview: '建国記念日をプレビュー中。', kicker: '建国記念日' },
      { ribbonTitle: '국경일', ribbonBody: '9월 2일', preview: '국경일 미리보기 중.', kicker: '국경일' }
    )
  ),
  look(
    'trung-thu',
    {
      strong: '#b45309',
      deep: '#1e3a5f',
      mid: '#d97706',
      gold: '#fde68a',
      goldSoft: '#fef3c7',
      paper: '#fffbeb',
      ink: '#92400e',
      dark: '#172554',
      themeColor: '#1e3a5f',
    },
    allCopy(
      { ribbonTitle: 'Trung thu', ribbonBody: 'Rằm tháng Tám', preview: 'Đang xem trước Trung thu.', kicker: 'Tết Trung thu' },
      { ribbonTitle: 'Mid-Autumn', ribbonBody: '15th day of the 8th lunar month', preview: 'Previewing Mid-Autumn Festival.', kicker: 'Mid-Autumn' },
      { ribbonTitle: '中秋', ribbonBody: '农历八月十五', preview: '正在预览中秋界面。', kicker: '中秋' },
      { ribbonTitle: '中秋', ribbonBody: '旧暦8月15日', preview: '中秋をプレビュー中。', kicker: '中秋' },
      { ribbonTitle: '중추', ribbonBody: '음력 8월 보름', preview: '중추절 미리보기 중.', kicker: '중추' }
    )
  ),
  look(
    'phu-nu-2010',
    {
      strong: '#be123c',
      deep: '#9f1239',
      mid: '#e11d48',
      gold: '#fecdd3',
      goldSoft: '#ffe4e6',
      paper: '#fff1f2',
      ink: '#9f1239',
      dark: '#881337',
      themeColor: '#9f1239',
    },
    allCopy(
      { ribbonTitle: '20/10', ribbonBody: 'Phụ nữ Việt Nam', preview: 'Đang xem trước 20/10.', kicker: '20/10' },
      { ribbonTitle: 'October 20', ribbonBody: 'Vietnamese Women’s Day', preview: 'Previewing Vietnamese Women’s Day.', kicker: 'Oct 20' },
      { ribbonTitle: '10月20日', ribbonBody: '越南妇女节', preview: '正在预览越南妇女节界面。', kicker: '10/20' },
      { ribbonTitle: '10月20日', ribbonBody: 'ベトナム女性の日', preview: 'ベトナム女性の日をプレビュー中。', kicker: '10/20' },
      { ribbonTitle: '10월 20일', ribbonBody: '베트남 여성의 날', preview: '베트남 여성의 날 미리보기 중.', kicker: '10/20' }
    )
  ),
  look(
    'nha-giao',
    {
      strong: '#1d4ed8',
      deep: '#1e3a8a',
      mid: '#2563eb',
      gold: '#fde68a',
      goldSoft: '#dbeafe',
      paper: '#eff6ff',
      ink: '#1e3a8a',
      dark: '#172554',
      themeColor: '#1e3a8a',
    },
    allCopy(
      { ribbonTitle: '20/11', ribbonBody: 'Tri ân nhà giáo', preview: 'Đang xem trước 20/11.', kicker: 'Nhà giáo Việt Nam' },
      { ribbonTitle: 'November 20', ribbonBody: 'Thanking teachers', preview: 'Previewing Teachers’ Day.', kicker: 'Teachers’ Day' },
      { ribbonTitle: '11月20日', ribbonBody: '感恩教师', preview: '正在预览教师节界面。', kicker: '教师节' },
      { ribbonTitle: '11月20日', ribbonBody: '教師に感謝を', preview: '教師の日をプレビュー中。', kicker: '教師の日' },
      { ribbonTitle: '11월 20일', ribbonBody: '선생님께 감사', preview: '스승의 날 미리보기 중.', kicker: '스승의 날' }
    )
  ),
  look(
    'giang-sinh',
    {
      strong: '#166534',
      deep: '#14532d',
      mid: '#15803d',
      gold: '#fecaca',
      goldSoft: '#dcfce7',
      paper: '#f0fdf4',
      ink: '#14532d',
      dark: '#052e16',
      themeColor: '#14532d',
    },
    allCopy(
      { ribbonTitle: 'Mùa Giáng sinh', ribbonBody: '24 và 25/12', preview: 'Đang xem trước Giáng sinh.', kicker: 'Giáng sinh' },
      { ribbonTitle: 'Christmas', ribbonBody: 'December 24 and 25', preview: 'Previewing Christmas.', kicker: 'Christmas' },
      { ribbonTitle: '圣诞', ribbonBody: '12月24日与25日', preview: '正在预览圣诞界面。', kicker: '圣诞' },
      { ribbonTitle: 'クリスマス', ribbonBody: '12月24日と25日', preview: 'クリスマスをプレビュー中。', kicker: 'クリスマス' },
      { ribbonTitle: '크리스마스', ribbonBody: '12월 24일과 25일', preview: '크리스마스 미리보기 중.', kicker: '크리스마스' }
    )
  ),
]

export const PARTNER_HOLIDAY_LOOKS: Record<PartnerHolidayThemeId, PartnerHolidayLook> = Object.fromEntries(
  LOOKS.map((item) => [item.id, item])
) as Record<PartnerHolidayThemeId, PartnerHolidayLook>

export function partnerHolidayLook(code: string | null | undefined): PartnerHolidayLook | null {
  if (!code || !(code in PARTNER_HOLIDAY_LOOKS)) return null
  return PARTNER_HOLIDAY_LOOKS[code as PartnerHolidayThemeId]
}

export function partnerHolidayLookCopy(code: string | null | undefined, locale: WebLocale): PartnerHolidayLookCopy | null {
  const item = partnerHolidayLook(code)
  return item ? item.copy[locale] ?? item.copy.vi : null
}

export function partnerHolidayCssVars(item: PartnerHolidayLook): Record<string, string> {
  return {
    '--h-strong': item.strong,
    '--h-deep': item.deep,
    '--h-mid': item.mid,
    '--h-gold': item.gold,
    '--h-gold-soft': item.goldSoft,
    '--h-paper': item.paper,
    '--h-ink': item.ink,
    '--h-dark': item.dark,
    '--pw-primary': item.strong,
    '--pw-accent': item.mid,
    '--pw-buy': item.strong,
    '--pw-cart': item.deep,
    '--pw-footer': item.deep,
  }
}

export function partnerHolidayOccasionName(code: PartnerHolidayThemeId, locale: WebLocale): string {
  return PARTNER_HOLIDAY_LOOKS[code].copy[locale]?.kicker ?? PARTNER_HOLIDAY_LOOKS[code].copy.vi.kicker
}

export const PARTNER_HOLIDAY_LOOK_IDS = PARTNER_HOLIDAY_THEME_IDS
