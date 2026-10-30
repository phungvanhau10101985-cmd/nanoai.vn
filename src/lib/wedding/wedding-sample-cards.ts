/**
 * Thiệp mẫu: mỗi nền một thiệp, 5 ảnh cô dâu chú rể cùng tông.
 * Ảnh chỉ để xem demo: 1 ảnh đầu thiệp, 2 chân dung ở phần riêng, 2 ảnh trong album.
 * Album giữ bố cục cũ, không ghép chân dung vào album.
 * Thêm từng mẫu một khi ảnh đã tạo xong.
 */
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { findWeddingBackgroundPreset, labelForWeddingBackgroundPreset, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingKitFramePatch, weddingReadyBackgroundSectionPatch, weddingThemeOpenCelebration } from '@/lib/wedding/wedding-background-presets'
import { weddingOrnamentLayoutKey } from '@/lib/wedding/wedding-background-ornament-store'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
import type { WebLocale } from '@/lib/i18n/config'
import { getWeddingStylePreset, labelForWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'

const SAMPLE_PHOTO_PREFIX = '/wedding/samples/'
const LIBRARY_CDN = 'https://cdn.nanoai.vn/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/wedding_417213ca-b2e3-4e2c-a642-d7bac605fad0_master_'

export type WeddingSampleTitle = {
  vi: string
  en: string
  zh: string
  ja: string
  ko: string
}

export type WeddingSampleCard = {
  id: string
  backgroundPresetId: string
  /** Chủ đề AI. Demo dùng kit AI, không gắn nền có sẵn. */
  aiStyleId?: string
  /** Ảnh nền đã có trong kho. Demo dùng đúng tấm này, không phủ hoa văn kit lên trên. */
  libraryImageUrl?: string
  titles?: WeddingSampleTitle
  coverPhotoUrl: string
  groomImageUrl: string
  brideImageUrl: string
  albumImageUrls: readonly [string, string]
  dressCode?: string
  /** 0 giữ mép trên, để khung vuông không cắt trán. */
  coverPhotoPositionY?: number
}

/** Khóa bố cục dùng chung của một thiệp mẫu. Quản trị sửa trên bản xem thử thì mọi khách của mẫu đó đọc khóa này. */
export function weddingSampleSharedLayoutKey(sample: Pick<WeddingSampleCard, 'backgroundPresetId' | 'aiStyleId' | 'libraryImageUrl'>): string {
  if (sample.libraryImageUrl) return weddingOrnamentLayoutKey({ masterImageUrl: sample.libraryImageUrl })
  return weddingOrnamentLayoutKey(
    sample.aiStyleId
      ? { backgroundKitStyleId: sample.aiStyleId }
      : { backgroundPresetId: sample.backgroundPresetId },
  )
}

/** Nền kho giữ nguyên ảnh vẽ. Màu nút theo chủ đề, không bật hoa văn của kit. */
export function weddingLibrarySampleSectionPatch(styleId: string | null | undefined, themeKey?: string | null) {
  const kit = weddingAiBackgroundKit(styleId)
  return {
    backgroundPresetId: '',
    backgroundKitStyleId: '',
    ...weddingKitFramePatch(kit),
    buttonColorId: kit.look.buttonColorId,
    coverRsvpColorId: kit.look.coverRsvpColorId,
    ...weddingThemeOpenCelebration(themeKey || styleId),
  }
}

function librarySample(input: {
  id: string
  file: string
  aiStyleId: string
  titles: WeddingSampleTitle
  dressCode: string
}): WeddingSampleCard {
  const folder = `/wedding/samples/${input.id}`
  return {
    id: input.id,
    backgroundPresetId: '',
    aiStyleId: input.aiStyleId,
    libraryImageUrl: `${LIBRARY_CDN}${input.file}.png`,
    titles: input.titles,
    coverPhotoUrl: `${folder}/cover.png`,
    groomImageUrl: `${folder}/groom.png`,
    brideImageUrl: `${folder}/bride.png`,
    albumImageUrls: [`${folder}/album-1.png`, `${folder}/album-2.png`],
    dressCode: input.dressCode,
    coverPhotoPositionY: 0,
  }
}

export const WEDDING_SAMPLE_CARDS: readonly WeddingSampleCard[] = [
  {
    id: 'toi-gian-nau',
    backgroundPresetId: 'toi-gian-nau',
    coverPhotoUrl: '/wedding/samples/toi-gian-nau/cover.png',
    groomImageUrl: '/wedding/samples/toi-gian-nau/groom.png',
    brideImageUrl: '/wedding/samples/toi-gian-nau/bride.png',
    albumImageUrls: ['/wedding/samples/toi-gian-nau/album-1.png', '/wedding/samples/toi-gian-nau/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, be hoặc nâu nhạt.',
  },
  {
    id: 'vuon-kinh-hong',
    backgroundPresetId: 'vuon-kinh-hong',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'long-phung-do',
    backgroundPresetId: 'long-phung-do',
    coverPhotoUrl: '/wedding/samples/long-phung-do/cover.png',
    groomImageUrl: '/wedding/samples/long-phung-do/groom.png',
    brideImageUrl: '/wedding/samples/long-phung-do/bride.png',
    albumImageUrls: ['/wedding/samples/long-phung-do/album-1.png', '/wedding/samples/long-phung-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc vàng nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'do-son',
    backgroundPresetId: 'do-son',
    coverPhotoUrl: '/wedding/samples/do-son/cover.png',
    groomImageUrl: '/wedding/samples/do-son/groom.png',
    brideImageUrl: '/wedding/samples/do-son/bride.png',
    albumImageUrls: ['/wedding/samples/do-son/album-1.png', '/wedding/samples/do-son/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ son, kem hoặc vàng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'song-hy-do',
    backgroundPresetId: 'song-hy-do',
    coverPhotoUrl: '/wedding/samples/song-hy-do/cover.png',
    groomImageUrl: '/wedding/samples/song-hy-do/groom.png',
    brideImageUrl: '/wedding/samples/song-hy-do/bride.png',
    albumImageUrls: ['/wedding/samples/song-hy-do/album-1.png', '/wedding/samples/song-hy-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'sen-vang',
    backgroundPresetId: 'sen-vang',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'hong-ngoc-trai',
    backgroundPresetId: 'hong-ngoc-trai',
    coverPhotoUrl: '/wedding/samples/hong-ngoc-trai/cover.png',
    groomImageUrl: '/wedding/samples/hong-ngoc-trai/groom.png',
    brideImageUrl: '/wedding/samples/hong-ngoc-trai/bride.png',
    albumImageUrls: ['/wedding/samples/hong-ngoc-trai/album-1.png', '/wedding/samples/hong-ngoc-trai/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'vuon-hong-troi',
    backgroundPresetId: 'vuon-hong-troi',
    coverPhotoUrl: '/wedding/samples/vuon-hong-troi/cover.png',
    groomImageUrl: '/wedding/samples/vuon-hong-troi/groom.png',
    brideImageUrl: '/wedding/samples/vuon-hong-troi/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-hong-troi/album-1.png', '/wedding/samples/vuon-hong-troi/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng nhạt, trắng hoặc xanh nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'hoa-moc-xanh',
    backgroundPresetId: 'hoa-moc-xanh',
    coverPhotoUrl: '/wedding/samples/hoa-moc-xanh/cover.png',
    groomImageUrl: '/wedding/samples/hoa-moc-xanh/groom.png',
    brideImageUrl: '/wedding/samples/hoa-moc-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/hoa-moc-xanh/album-1.png', '/wedding/samples/hoa-moc-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh lá nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'to-duyen-xanh',
    backgroundPresetId: 'to-duyen-xanh',
    coverPhotoUrl: '/wedding/samples/to-duyen-xanh/cover.png',
    groomImageUrl: '/wedding/samples/to-duyen-xanh/groom.png',
    brideImageUrl: '/wedding/samples/to-duyen-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/to-duyen-xanh/album-1.png', '/wedding/samples/to-duyen-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'do-dam',
    backgroundPresetId: 'do-dam',
    coverPhotoUrl: '/wedding/samples/do-dam/cover.png',
    groomImageUrl: '/wedding/samples/do-dam/groom.png',
    brideImageUrl: '/wedding/samples/do-dam/bride.png',
    albumImageUrls: ['/wedding/samples/do-dam/album-1.png', '/wedding/samples/do-dam/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-luxury',
    backgroundPresetId: '',
    aiStyleId: 'luxury',
    coverPhotoUrl: '/wedding/samples/ai-luxury/cover.png',
    groomImageUrl: '/wedding/samples/ai-luxury/groom.png',
    brideImageUrl: '/wedding/samples/ai-luxury/bride.png',
    albumImageUrls: ['/wedding/samples/ai-luxury/album-1.png', '/wedding/samples/ai-luxury/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng champagne hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-minimal',
    backgroundPresetId: '',
    aiStyleId: 'minimal',
    coverPhotoUrl: '/wedding/samples/ai-minimal/cover.png',
    groomImageUrl: '/wedding/samples/ai-minimal/groom.png',
    brideImageUrl: '/wedding/samples/ai-minimal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-minimal/album-1.png', '/wedding/samples/ai-minimal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-traditional_vietnamese',
    backgroundPresetId: '',
    aiStyleId: 'traditional_vietnamese',
    coverPhotoUrl: '/wedding/samples/ai-traditional_vietnamese/cover.png',
    groomImageUrl: '/wedding/samples/ai-traditional_vietnamese/groom.png',
    brideImageUrl: '/wedding/samples/ai-traditional_vietnamese/bride.png',
    albumImageUrls: ['/wedding/samples/ai-traditional_vietnamese/album-1.png', '/wedding/samples/ai-traditional_vietnamese/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-floral',
    backgroundPresetId: '',
    aiStyleId: 'floral',
    coverPhotoUrl: '/wedding/samples/ai-floral/cover.png',
    groomImageUrl: '/wedding/samples/ai-floral/groom.png',
    brideImageUrl: '/wedding/samples/ai-floral/bride.png',
    albumImageUrls: ['/wedding/samples/ai-floral/album-1.png', '/wedding/samples/ai-floral/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-ethereal',
    backgroundPresetId: '',
    aiStyleId: 'ethereal',
    coverPhotoUrl: '/wedding/samples/ai-ethereal/cover.png',
    groomImageUrl: '/wedding/samples/ai-ethereal/groom.png',
    brideImageUrl: '/wedding/samples/ai-ethereal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-ethereal/album-1.png', '/wedding/samples/ai-ethereal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, trắng hoặc hồng rất nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-vintage',
    backgroundPresetId: '',
    aiStyleId: 'vintage',
    coverPhotoUrl: '/wedding/samples/ai-vintage/cover.png',
    groomImageUrl: '/wedding/samples/ai-vintage/groom.png',
    brideImageUrl: '/wedding/samples/ai-vintage/bride.png',
    albumImageUrls: ['/wedding/samples/ai-vintage/album-1.png', '/wedding/samples/ai-vintage/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, hồng cổ hoặc nâu nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'ai-modern',
    backgroundPresetId: '',
    aiStyleId: 'modern',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng kim.',
    coverPhotoPositionY: 0,
  },
  librarySample({
    id: 'kho-hong-buom',
    file: '1792295417507',
    aiStyleId: 'floral',
    titles: { vi: 'Hồng bướm', en: 'Blush butterflies', zh: '粉蝶', ja: '蝶と薔薇', ko: '나비와 장미' },
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
  }),
  librarySample({
    id: 'kho-sen-hong',
    file: '1792294270595',
    aiStyleId: 'floral',
    titles: { vi: 'Sen hồng', en: 'Pink lotus', zh: '粉莲', ja: 'ピンクの蓮', ko: '분홍 연꽃' },
    dressCode: 'Trang phục lịch sự, tông hồng, kem hoặc vàng nhạt.',
  }),
  librarySample({
    id: 'kho-hac-sen',
    file: '1792245305419',
    aiStyleId: 'traditional_vietnamese',
    titles: { vi: 'Hạc và sen', en: 'Crane and lotus', zh: '鹤与莲', ja: '鶴と蓮', ko: '학과 연꽃' },
    dressCode: 'Trang phục lịch sự, tông đỏ, hồng hoặc vàng.',
  }),
  librarySample({
    id: 'kho-hac-do',
    file: '1792245273399',
    aiStyleId: 'traditional_vietnamese',
    titles: { vi: 'Hạc đỏ', en: 'Red crane', zh: '朱鹤', ja: '朱の鶴', ko: '붉은 학' },
    dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.',
  }),
  librarySample({
    id: 'kho-phung-do',
    file: '1792244248569',
    aiStyleId: 'traditional_vietnamese',
    titles: { vi: 'Phượng đỏ', en: 'Red phoenix', zh: '赤凤', ja: '赤の鳳凰', ko: '붉은 봉황' },
    dressCode: 'Trang phục lịch sự, tông đỏ đô hoặc vàng.',
  }),
  librarySample({
    id: 'kho-mau-don',
    file: '1792244045885',
    aiStyleId: 'vintage',
    titles: { vi: 'Mẫu đơn', en: 'Peony', zh: '牡丹', ja: '牡丹', ko: '모란' },
    dressCode: 'Trang phục lịch sự, tông kem, đỏ đô hoặc trắng.',
  }),
  librarySample({
    id: 'kho-do-phap',
    file: '1792243323419',
    aiStyleId: 'traditional_vietnamese',
    titles: { vi: 'Đỏ pháo hoa', en: 'Red fireworks', zh: '红焰烟花', ja: '紅の花火', ko: '붉은 불꽃' },
    dressCode: 'Trang phục lịch sự, tông đỏ hoặc vàng.',
  }),
]

const SAMPLE_BY_ID = new Map(WEDDING_SAMPLE_CARDS.map((sample) => [sample.id, sample]))
const SAMPLE_BY_PRESET = new Map(
  WEDDING_SAMPLE_CARDS.filter((sample) => sample.backgroundPresetId).map((sample) => [sample.backgroundPresetId, sample]),
)

export function weddingSampleCardTitle(locale: WebLocale, sample: WeddingSampleCard): string {
  if (sample.titles) return sample.titles[locale] || sample.titles.vi
  if (sample.aiStyleId) return labelForWeddingStylePreset(locale, getWeddingStylePreset(sample.aiStyleId))
  const preset = findWeddingBackgroundPreset(sample.backgroundPresetId)
  return preset ? labelForWeddingBackgroundPreset(locale, preset) : ''
}

export function findWeddingSampleCard(id: string | null | undefined): WeddingSampleCard | undefined {
  const key = id?.trim() || ''
  if (!key) return undefined
  return SAMPLE_BY_ID.get(key) ?? SAMPLE_BY_PRESET.get(key)
}

export function weddingSamplePhotoUrls(sample: WeddingSampleCard): string[] {
  return [sample.coverPhotoUrl, sample.groomImageUrl, sample.brideImageUrl, ...sample.albumImageUrls]
}

export function isWeddingSamplePhotoUrl(url: string | null | undefined): boolean {
  return (url?.trim() || '').startsWith(SAMPLE_PHOTO_PREFIX)
}

/** Bỏ ảnh mẫu khỏi thiệp đang sửa. Ảnh thật của khách giữ nguyên. */
export function stripWeddingSamplePhotos<T extends {
  groomImageUrl: string
  brideImageUrl: string
  albumImageUrls: string[]
  sectionConfig: string
}>(card: T): T {
  const groomImageUrl = isWeddingSamplePhotoUrl(card.groomImageUrl) ? '' : card.groomImageUrl
  const brideImageUrl = isWeddingSamplePhotoUrl(card.brideImageUrl) ? '' : card.brideImageUrl
  const albumImageUrls = card.albumImageUrls.filter((url) => !isWeddingSamplePhotoUrl(url))
  const section = parseWeddingSectionConfig(card.sectionConfig)
  const coverWasSample = isWeddingSamplePhotoUrl(section.coverPhotoUrl)
  const albumChanged = albumImageUrls.length !== card.albumImageUrls.length
  if (
    groomImageUrl === card.groomImageUrl &&
    brideImageUrl === card.brideImageUrl &&
    !albumChanged &&
    !coverWasSample
  ) {
    return card
  }
  return {
    ...card,
    groomImageUrl,
    brideImageUrl,
    albumImageUrls,
    sectionConfig: mergeWeddingSectionConfig(card.sectionConfig, {
      ...(coverWasSample ? { coverPhotoUrl: '' } : {}),
      ...(albumChanged ? { albumPhotoCrops: [] } : {}),
    }),
  }
}

/** Thiệp demo đủ ảnh mẫu. Không phải thiệp của khách. */
export function buildWeddingSampleDemoCard(sample: WeddingSampleCard): WeddingCard | null {
  const preset = sample.aiStyleId
    ? weddingAiBackgroundKit(sample.aiStyleId)
    : findWeddingBackgroundPreset(sample.backgroundPresetId)
  if (!preset) return null
  const style = getWeddingStylePreset(sample.aiStyleId || preset.look.styleId)
  const sectionPatch = sample.libraryImageUrl
    ? weddingLibrarySampleSectionPatch(sample.aiStyleId, sample.id)
    : sample.aiStyleId
      ? weddingAiKitSectionPatch(sample.aiStyleId)
      : weddingReadyBackgroundSectionPatch(preset)
  const blank = ''
  return {
    id: `sample:${sample.id}`,
    userId: blank,
    slug: blank,
    occasionKey: 'wedding',
    groomName: 'Nguyễn Minh',
    brideName: 'Trần Lan',
    weddingDate: '2026-12-20',
    weddingTime: '17:00',
    partyStartTime: '18:00',
    venue: 'Số 12 phố Huế, Hai Bà Trưng, Hà Nội',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=12%20phố%20Huế%20Hai%20Bà%20Trưng%20Hà%20Nội',
    invitationText: 'Trân trọng kính mời quý khách đến dự lễ thành hôn của Nguyễn Minh và Trần Lan.',
    invitationTextEn: 'We joyfully invite you to the wedding celebration of Nguyen Minh and Tran Lan.',
    guestName: 'Anh Thanh',
    guestInviteVenue: '',
    storyText: 'Minh và Lan gặp nhau một chiều cuối thu, rồi cùng đi qua những ngày bình thường bằng sự tử tế và tiếng cười. Hôm nay hai người mời quý khách chứng kiến lúc mình chính thức về chung một nhà.',
    coupleIntro: 'Hai gia đình hân hoan báo tin lễ thành hôn của con chúng tôi.',
    loveQuote: 'Có những yêu thương không cần quá ồn ào, chỉ cần đủ chân thành để cùng nhau đi hết cuộc đời.',
    eventTimeline: '17:00 | Đón khách\n17:30 | Lễ thành hôn\n18:00 | Khai tiệc\n19:30 | Cảm ơn và chia tay',
    dressCode: sample.dressCode || 'Trang phục lịch sự, tông kem, be hoặc nâu nhạt.',
    thankYouText: 'Nguyễn Minh và Trần Lan xin cảm ơn quý khách đã đến chung vui. Sự hiện diện và lời chúc của quý khách là món quà quý nhất của hai gia đình.',
    sectionConfig: mergeWeddingSectionConfig('{}', {
      ...sectionPatch,
      coverPhotoUrl: sample.coverPhotoUrl,
      ...(typeof sample.coverPhotoPositionY === 'number' ? { coverPhotoPositionY: sample.coverPhotoPositionY } : {}),
    }),
    albumImageUrls: [...sample.albumImageUrls],
    groomParents: 'Ông Nguyễn Văn An và Bà Lê Thị Bình',
    brideParents: 'Ông Trần Văn Cường và Bà Phạm Thị Dung',
    groomHometown: 'Hà Nội',
    brideHometown: 'Hải Phòng',
    groomInviteAddress: 'Số 12 phố Huế, Hai Bà Trưng, Hà Nội',
    groomInviteMapUrl: 'https://www.google.com/maps/search/?api=1&query=12%20phố%20Huế%20Hai%20Bà%20Trưng%20Hà%20Nội',
    groomInviteReceptionTime: '17:00',
    groomInvitePartyStartTime: '18:00',
    brideInviteAddress: 'Số 8 đường Lạch Tray, Ngô Quyền, Hải Phòng',
    brideInviteMapUrl: 'https://www.google.com/maps/search/?api=1&query=8%20Lạch%20Tray%20Ngô%20Quyền%20Hải%20Phòng',
    brideInviteReceptionTime: '10:30',
    brideInvitePartyStartTime: '11:30',
    groomInviteWeddingDate: '2026-12-20',
    groomInviteText: blank,
    groomInviteTextEn: blank,
    groomInviteEventTimeline: '17:00 | Đón khách nhà trai\n17:30 | Lễ thành hôn\n18:00 | Khai tiệc\n19:30 | Cảm ơn và chia tay',
    groomInviteDressCode: blank,
    groomInviteContact: '0900 000 001',
    groomInviteCoverImageUrl: blank,
    groomInviteDefaultPersonalMessage: blank,
    groomInviteThankYouText: blank,
    brideInviteWeddingDate: '2026-12-19',
    brideInviteText: blank,
    brideInviteTextEn: blank,
    brideInviteEventTimeline: '10:30 | Đón khách nhà gái\n11:00 | Lễ gia tiên\n11:30 | Tiệc thân mật\n13:00 | Cảm ơn và chia tay',
    brideInviteDressCode: blank,
    brideInviteContact: '0900 000 002',
    brideInviteCoverImageUrl: blank,
    brideInviteDefaultPersonalMessage: blank,
    brideInviteThankYouText: blank,
    groomImageUrl: sample.groomImageUrl,
    brideImageUrl: sample.brideImageUrl,
    musicUrl: blank,
    musicPlayStartSec: null,
    musicPlayEndSec: null,
    selectedStyleId: sample.aiStyleId || preset.look.styleId,
    colorPalette: style.palette,
    masterImageId: null,
    rsvpEnabled: true,
    giftQrEnabled: true,
    giftQrImageUrl: blank,
    groomGiftBankId: 'VCB',
    groomGiftAccountNo: '0123456789',
    groomGiftAccountName: 'NGUYEN VAN MINH',
    brideGiftBankId: 'VCB',
    brideGiftAccountNo: '9876543210',
    brideGiftAccountName: 'TRAN THI LAN',
    isPublished: false,
    publishedAt: null,
    masterImageUrl: sample.libraryImageUrl || null,
    effectsEnabled: true,
  }
}
