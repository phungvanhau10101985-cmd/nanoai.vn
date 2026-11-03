/**
 * Thiệp mẫu: mỗi nền một thiệp, 5 ảnh cô dâu chú rể cùng tông.
 * Ảnh chỉ để xem demo: 1 ảnh đầu thiệp, 2 chân dung ở phần riêng, 2 ảnh trong album.
 * Album giữ bố cục cũ, không ghép chân dung vào album.
 * Thêm từng mẫu một khi ảnh đã tạo xong.
 */
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { findWeddingBackgroundPreset, labelForWeddingBackgroundPreset, weddingAiBackgroundKit, weddingAiKitSectionPatch, weddingKitFramePatch, weddingReadyBackgroundSectionPatch, weddingThemeOpenCelebration } from '@/lib/wedding/wedding-background-presets'
import { WEDDING_LEAF_CARDS, WEDDING_MOON_CARDS, type WeddingGateToneId, type WeddingMoonShape } from '@/lib/wedding/wedding-cover-presets'
import { weddingOrnamentLayoutKey } from '@/lib/wedding/wedding-background-ornament-store'
import { clearWeddingFrameChoice, mergeWeddingSectionConfig, parseWeddingSectionConfig, stringifyWeddingSectionConfig, withoutPrivateShell } from '@/lib/wedding/wedding-section-config'
import type { WebLocale } from '@/lib/i18n/config'
import { getWeddingStylePreset, labelForWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'
import { normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { OCCASION_ALIAS_SAMPLES, OCCASION_DEMO_IDS, weddingSampleDemoFacts } from '@/lib/wedding/wedding-occasion-demos'

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
  /** Trống thì coi là thiệp cưới. Gợi ý «ngày gặp nhau» chỉ hiện khi là cưới. */
  occasionKey?: string
  /** 0 giữ mép trên, để khung vuông không cắt trán. */
  coverPhotoPositionY?: number
  /** Kéo mặt ngang trong khung. 50 là giữa. */
  coverPhotoPositionX?: number
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

/** Mẫu kho không phải hoa hồng thì không dùng khung hồng của nhóm floral. */
const LIBRARY_COVER_FRAME: Record<string, string> = {
  'kho-sen-hong': 'net_sen',
}

/** Nền kho giữ nguyên ảnh vẽ. Màu nút theo chủ đề, không bật hoa văn của kit. */
export function weddingLibrarySampleSectionPatch(styleId: string | null | undefined, themeKey?: string | null) {
  const kit = weddingAiBackgroundKit(styleId)
  const coverPresetId = LIBRARY_COVER_FRAME[themeKey?.trim() || '']
  const framed = coverPresetId ? { ...kit, coverPresetId } : kit
  return {
    backgroundPresetId: '',
    backgroundKitStyleId: '',
    ...weddingKitFramePatch(framed),
    buttonColorId: kit.look.buttonColorId,
    coverRsvpColorId: kit.look.coverRsvpColorId,
    ...weddingThemeOpenCelebration(themeKey || styleId),
  }
}

function librarySample(input: {
  id: string
  file?: string
  imageUrl?: string
  aiStyleId: string
  titles: WeddingSampleTitle
  dressCode: string
}): WeddingSampleCard {
  const folder = `/wedding/samples/${input.id}`
  const libraryImageUrl = input.imageUrl?.trim() || `${LIBRARY_CDN}${input.file}.png`
  return {
    id: input.id,
    backgroundPresetId: '',
    aiStyleId: input.aiStyleId,
    libraryImageUrl,
    titles: input.titles,
    coverPhotoUrl: `${folder}/cover.png`,
    groomImageUrl: `${folder}/groom.png`,
    brideImageUrl: `${folder}/bride.png`,
    albumImageUrls: [`${folder}/album-1.png`, `${folder}/album-2.png`],
    dressCode: input.dressCode,
    coverPhotoPositionY: 0,
  }
}

const MOON_SAMPLE_PHOTO: Record<WeddingGateToneId, { folder: string; dressCode: string }> = {
  lacquer: { folder: 'song-hy-do', dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.' },
  lotus: { folder: 'sen-vang', dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc trắng.' },
  pearl: { folder: 'hong-ngoc-trai', dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.' },
  night: { folder: 'ai-modern', dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng champagne.' },
  sea: { folder: 'ai-minimal', dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh biển.' },
}

function moonSampleCards(): WeddingSampleCard[] {
  return WEDDING_MOON_CARDS.map((card) => {
    const photo = MOON_SAMPLE_PHOTO[card.paper]
    const folder = `/wedding/samples/${photo.folder}`
    const positionY = moonSamplePositionY(card.shape)
    return {
      id: card.backgroundId,
      backgroundPresetId: card.backgroundId,
      coverPhotoUrl: `${folder}/cover.png`,
      groomImageUrl: `${folder}/groom.png`,
      brideImageUrl: `${folder}/bride.png`,
      albumImageUrls: [`${folder}/album-1.png`, `${folder}/album-2.png`],
      dressCode: photo.dressCode,
      coverPhotoPositionY: positionY,
    }
  })
}

function moonSamplePositionY(shape: WeddingMoonShape): number {
  if (shape === 'star') return 8
  return 18
}

function leafSamplePositionY(paper: WeddingGateToneId): number {
  if (paper === 'lotus') return 42
  return 22
}

function leafSampleCards(): WeddingSampleCard[] {
  return WEDDING_LEAF_CARDS.map((card) => {
    const photo = MOON_SAMPLE_PHOTO[card.paper]
    const folder = `/wedding/samples/${photo.folder}`
    return {
      id: card.backgroundId,
      backgroundPresetId: card.backgroundId,
      coverPhotoUrl: `${folder}/cover.png`,
      groomImageUrl: `${folder}/groom.png`,
      brideImageUrl: `${folder}/bride.png`,
      albumImageUrls: [`${folder}/album-1.png`, `${folder}/album-2.png`],
      dressCode: photo.dressCode,
      coverPhotoPositionY: leafSamplePositionY(card.paper),
    }
  })
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
    id: 're-quat',
    backgroundPresetId: 're-quat',
    coverPhotoUrl: '/wedding/samples/song-hy-do/cover.png',
    groomImageUrl: '/wedding/samples/song-hy-do/groom.png',
    brideImageUrl: '/wedding/samples/song-hy-do/bride.png',
    albumImageUrls: ['/wedding/samples/song-hy-do/album-1.png', '/wedding/samples/song-hy-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.',
    coverPhotoPositionY: 18,
  },
  {
    id: 're-quat-sen',
    backgroundPresetId: 're-quat-sen',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc trắng.',
    coverPhotoPositionY: 18,
  },
  {
    id: 're-quat-ngoc',
    backgroundPresetId: 're-quat-ngoc',
    coverPhotoUrl: '/wedding/samples/hong-ngoc-trai/cover.png',
    groomImageUrl: '/wedding/samples/hong-ngoc-trai/groom.png',
    brideImageUrl: '/wedding/samples/hong-ngoc-trai/bride.png',
    albumImageUrls: ['/wedding/samples/hong-ngoc-trai/album-1.png', '/wedding/samples/hong-ngoc-trai/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 18,
  },
  {
    id: 're-quat-dem',
    backgroundPresetId: 're-quat-dem',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng champagne.',
    coverPhotoPositionY: 18,
  },
  {
    id: 're-quat-bien',
    backgroundPresetId: 're-quat-bien',
    coverPhotoUrl: '/wedding/samples/ai-minimal/cover.png',
    groomImageUrl: '/wedding/samples/ai-minimal/groom.png',
    brideImageUrl: '/wedding/samples/ai-minimal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-minimal/album-1.png', '/wedding/samples/ai-minimal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh biển.',
    coverPhotoPositionY: 18,
  },
  {
    id: 'vom-sen',
    backgroundPresetId: 'vom-sen',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'vom-ngoc',
    backgroundPresetId: 'vom-ngoc',
    coverPhotoUrl: '/wedding/samples/hong-ngoc-trai/cover.png',
    groomImageUrl: '/wedding/samples/hong-ngoc-trai/groom.png',
    brideImageUrl: '/wedding/samples/hong-ngoc-trai/bride.png',
    albumImageUrls: ['/wedding/samples/hong-ngoc-trai/album-1.png', '/wedding/samples/hong-ngoc-trai/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'vom-dem',
    backgroundPresetId: 'vom-dem',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng champagne.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'vom-bien',
    backgroundPresetId: 'vom-bien',
    coverPhotoUrl: '/wedding/samples/ai-minimal/cover.png',
    groomImageUrl: '/wedding/samples/ai-minimal/groom.png',
    brideImageUrl: '/wedding/samples/ai-minimal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-minimal/album-1.png', '/wedding/samples/ai-minimal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh biển.',
    coverPhotoPositionY: 0,
  },
  ...moonSampleCards(),
  ...leafSampleCards(),
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
    id: 'doi-anh-nau',
    backgroundPresetId: 'doi-anh-nau',
    coverPhotoUrl: '/wedding/samples/toi-gian-nau/cover.png',
    groomImageUrl: '/wedding/samples/toi-gian-nau/groom.png',
    brideImageUrl: '/wedding/samples/toi-gian-nau/bride.png',
    albumImageUrls: ['/wedding/samples/toi-gian-nau/album-1.png', '/wedding/samples/toi-gian-nau/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, be hoặc nâu nhạt.',
  },
  {
    id: 'doi-anh-hong',
    backgroundPresetId: 'doi-anh-hong',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
  },
  {
    id: 'doi-anh-long-phung',
    backgroundPresetId: 'doi-anh-long-phung',
    coverPhotoUrl: '/wedding/samples/long-phung-do/cover.png',
    groomImageUrl: '/wedding/samples/long-phung-do/groom.png',
    brideImageUrl: '/wedding/samples/long-phung-do/bride.png',
    albumImageUrls: ['/wedding/samples/long-phung-do/album-1.png', '/wedding/samples/long-phung-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc vàng nhạt.',
  },
  {
    id: 'doi-anh-do-son',
    backgroundPresetId: 'doi-anh-do-son',
    coverPhotoUrl: '/wedding/samples/do-son/cover.png',
    groomImageUrl: '/wedding/samples/do-son/groom.png',
    brideImageUrl: '/wedding/samples/do-son/bride.png',
    albumImageUrls: ['/wedding/samples/do-son/album-1.png', '/wedding/samples/do-son/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.',
  },
  {
    id: 'doi-anh-song-hy',
    backgroundPresetId: 'doi-anh-song-hy',
    coverPhotoUrl: '/wedding/samples/song-hy-do/cover.png',
    groomImageUrl: '/wedding/samples/song-hy-do/groom.png',
    brideImageUrl: '/wedding/samples/song-hy-do/bride.png',
    albumImageUrls: ['/wedding/samples/song-hy-do/album-1.png', '/wedding/samples/song-hy-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ hoặc vàng.',
  },
  {
    id: 'doi-anh-sen',
    backgroundPresetId: 'doi-anh-sen',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc trắng.',
  },
  {
    id: 'doi-anh-ngoc',
    backgroundPresetId: 'doi-anh-ngoc',
    coverPhotoUrl: '/wedding/samples/hong-ngoc-trai/cover.png',
    groomImageUrl: '/wedding/samples/hong-ngoc-trai/groom.png',
    brideImageUrl: '/wedding/samples/hong-ngoc-trai/bride.png',
    albumImageUrls: ['/wedding/samples/hong-ngoc-trai/album-1.png', '/wedding/samples/hong-ngoc-trai/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
  },
  {
    id: 'doi-anh-lech',
    backgroundPresetId: 'doi-anh-lech',
    coverPhotoUrl: '/wedding/samples/toi-gian-nau/cover.png',
    groomImageUrl: '/wedding/samples/toi-gian-nau/groom.png',
    brideImageUrl: '/wedding/samples/toi-gian-nau/bride.png',
    albumImageUrls: ['/wedding/samples/toi-gian-nau/album-1.png', '/wedding/samples/toi-gian-nau/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, be hoặc nâu nhạt.',
  },
  {
    id: 'doi-anh-nghieng',
    backgroundPresetId: 'doi-anh-nghieng',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
  },
  {
    id: 'doi-anh-vong',
    backgroundPresetId: 'doi-anh-vong',
    coverPhotoUrl: '/wedding/samples/song-hy-do/cover.png',
    groomImageUrl: '/wedding/samples/song-hy-do/groom.png',
    brideImageUrl: '/wedding/samples/song-hy-do/bride.png',
    albumImageUrls: ['/wedding/samples/song-hy-do/album-1.png', '/wedding/samples/song-hy-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ hoặc vàng.',
  },
  {
    id: 'doi-anh-the',
    backgroundPresetId: 'doi-anh-the',
    coverPhotoUrl: '/wedding/samples/long-phung-do/cover.png',
    groomImageUrl: '/wedding/samples/long-phung-do/groom.png',
    brideImageUrl: '/wedding/samples/long-phung-do/bride.png',
    albumImageUrls: ['/wedding/samples/long-phung-do/album-1.png', '/wedding/samples/long-phung-do/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc vàng nhạt.',
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
    id: 'phong-bi-thu',
    backgroundPresetId: 'phong-bi-thu',
    coverPhotoUrl: '/wedding/samples/do-dam/cover.png',
    groomImageUrl: '/wedding/samples/do-dam/groom.png',
    brideImageUrl: '/wedding/samples/do-dam/bride.png',
    albumImageUrls: ['/wedding/samples/do-dam/album-1.png', '/wedding/samples/do-dam/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'phong-bi-hong',
    backgroundPresetId: 'phong-bi-hong',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'phong-bi-reu',
    backgroundPresetId: 'phong-bi-reu',
    coverPhotoUrl: '/wedding/samples/to-duyen-xanh/cover.png',
    groomImageUrl: '/wedding/samples/to-duyen-xanh/groom.png',
    brideImageUrl: '/wedding/samples/to-duyen-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/to-duyen-xanh/album-1.png', '/wedding/samples/to-duyen-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh rêu.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'phong-bi-dem',
    backgroundPresetId: 'phong-bi-dem',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông xanh đêm, trắng hoặc vàng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'phong-bi-nga',
    backgroundPresetId: 'phong-bi-nga',
    coverPhotoUrl: '/wedding/samples/ai-ethereal/cover.png',
    groomImageUrl: '/wedding/samples/ai-ethereal/groom.png',
    brideImageUrl: '/wedding/samples/ai-ethereal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-ethereal/album-1.png', '/wedding/samples/ai-ethereal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông ngà, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'hoa-dao',
    backgroundPresetId: 'hoa-dao',
    coverPhotoUrl: '/wedding/samples/kho-hong-baby/cover.png',
    groomImageUrl: '/wedding/samples/kho-hong-baby/groom.png',
    brideImageUrl: '/wedding/samples/kho-hong-baby/bride.png',
    albumImageUrls: ['/wedding/samples/kho-hong-baby/album-1.png', '/wedding/samples/kho-hong-baby/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng đào, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'bien',
    backgroundPresetId: 'bien',
    coverPhotoUrl: '/wedding/samples/ai-minimal/cover.png',
    groomImageUrl: '/wedding/samples/ai-minimal/groom.png',
    brideImageUrl: '/wedding/samples/ai-minimal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-minimal/album-1.png', '/wedding/samples/ai-minimal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh biển.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'dem-vang',
    backgroundPresetId: 'dem-vang',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng champagne.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'lua-ao-dai',
    backgroundPresetId: 'lua-ao-dai',
    coverPhotoUrl: '/wedding/samples/ai-ethereal/cover.png',
    groomImageUrl: '/wedding/samples/ai-ethereal/groom.png',
    brideImageUrl: '/wedding/samples/ai-ethereal/bride.png',
    albumImageUrls: ['/wedding/samples/ai-ethereal/album-1.png', '/wedding/samples/ai-ethereal/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc lụa ngà.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'hoa-dao-van',
    backgroundPresetId: 'hoa-dao-van',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông hồng đào, kem hoặc trắng.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'bien-van',
    backgroundPresetId: 'bien-van',
    coverPhotoUrl: '/wedding/samples/to-duyen-xanh/cover.png',
    groomImageUrl: '/wedding/samples/to-duyen-xanh/groom.png',
    brideImageUrl: '/wedding/samples/to-duyen-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/to-duyen-xanh/album-1.png', '/wedding/samples/to-duyen-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh biển.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'dem-vang-van',
    backgroundPresetId: 'dem-vang-van',
    coverPhotoUrl: '/wedding/samples/ai-modern/cover.png',
    groomImageUrl: '/wedding/samples/ai-modern/groom.png',
    brideImageUrl: '/wedding/samples/ai-modern/bride.png',
    albumImageUrls: ['/wedding/samples/ai-modern/album-1.png', '/wedding/samples/ai-modern/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông đen, trắng hoặc vàng champagne.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'lua-van',
    backgroundPresetId: 'lua-van',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc lụa ngà.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'tre-viet',
    backgroundPresetId: 'tre-viet',
    coverPhotoUrl: '/wedding/samples/hoa-moc-xanh/cover.png',
    groomImageUrl: '/wedding/samples/hoa-moc-xanh/groom.png',
    brideImageUrl: '/wedding/samples/hoa-moc-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/hoa-moc-xanh/album-1.png', '/wedding/samples/hoa-moc-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh tre.',
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
    id: 'chua-mot-cot',
    backgroundPresetId: 'chua-mot-cot',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc vàng sen.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'van-mieu',
    backgroundPresetId: 'van-mieu',
    coverPhotoUrl: '/wedding/samples/ai-vintage/cover.png',
    groomImageUrl: '/wedding/samples/ai-vintage/groom.png',
    brideImageUrl: '/wedding/samples/ai-vintage/bride.png',
    albumImageUrls: ['/wedding/samples/ai-vintage/album-1.png', '/wedding/samples/ai-vintage/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, nâu hoặc vàng mai.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'cho-ben-thanh',
    backgroundPresetId: 'cho-ben-thanh',
    coverPhotoUrl: '/wedding/samples/vuon-kinh-hong/cover.png',
    groomImageUrl: '/wedding/samples/vuon-kinh-hong/groom.png',
    brideImageUrl: '/wedding/samples/vuon-kinh-hong/bride.png',
    albumImageUrls: ['/wedding/samples/vuon-kinh-hong/album-1.png', '/wedding/samples/vuon-kinh-hong/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, vàng cúc hoặc đỏ đất.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'vinh-ha-long',
    backgroundPresetId: 'vinh-ha-long',
    coverPhotoUrl: '/wedding/samples/to-duyen-xanh/cover.png',
    groomImageUrl: '/wedding/samples/to-duyen-xanh/groom.png',
    brideImageUrl: '/wedding/samples/to-duyen-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/to-duyen-xanh/album-1.png', '/wedding/samples/to-duyen-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh vịnh.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'lang-bac',
    backgroundPresetId: 'lang-bac',
    coverPhotoUrl: '/wedding/samples/ai-luxury/cover.png',
    groomImageUrl: '/wedding/samples/ai-luxury/groom.png',
    brideImageUrl: '/wedding/samples/ai-luxury/bride.png',
    albumImageUrls: ['/wedding/samples/ai-luxury/album-1.png', '/wedding/samples/ai-luxury/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh lá nhạt.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'que-nghe-an',
    backgroundPresetId: 'que-nghe-an',
    coverPhotoUrl: '/wedding/samples/hoa-moc-xanh/cover.png',
    groomImageUrl: '/wedding/samples/hoa-moc-xanh/groom.png',
    brideImageUrl: '/wedding/samples/hoa-moc-xanh/bride.png',
    albumImageUrls: ['/wedding/samples/hoa-moc-xanh/album-1.png', '/wedding/samples/hoa-moc-xanh/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, rơm hoặc xanh cau.',
    coverPhotoPositionY: 0,
  },
  {
    id: 'duong-lam',
    backgroundPresetId: 'duong-lam',
    coverPhotoUrl: '/wedding/samples/sen-vang/cover.png',
    groomImageUrl: '/wedding/samples/sen-vang/groom.png',
    brideImageUrl: '/wedding/samples/sen-vang/bride.png',
    albumImageUrls: ['/wedding/samples/sen-vang/album-1.png', '/wedding/samples/sen-vang/album-2.png'],
    dressCode: 'Trang phục lịch sự, tông kem, nâu đất hoặc vàng.',
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
  librarySample({
    id: 'kho-hong-baby',
    imageUrl: 'https://cdn.nanoai.vn/results/5b798db2-a4a7-41dd-a03b-aebb709a4d11/wedding_77f0b5ba-14c7-4bca-a50a-f38562b4bc84_master_1793034395126.png',
    aiStyleId: 'floral',
    titles: { vi: 'Hồng baby', en: 'Blush roses', zh: '粉玫瑰', ja: '淡いバラ', ko: '블러시 장미' },
    dressCode: 'Trang phục lịch sự, tông hồng phấn, kem hoặc trắng.',
  }),
  ...OCCASION_ALIAS_SAMPLES,
]

for (const [occasion, ids] of Object.entries(OCCASION_DEMO_IDS)) {
  for (const id of ids) {
    const sample = WEDDING_SAMPLE_CARDS.find((item) => item.id === id)
    if (sample) sample.occasionKey = occasion
  }
}

const SAMPLE_BY_ID = new Map(WEDDING_SAMPLE_CARDS.map((sample) => [sample.id, sample]))
const SAMPLE_BY_PRESET = new Map<string, WeddingSampleCard>()
for (const sample of WEDDING_SAMPLE_CARDS) {
  if (!sample.backgroundPresetId) continue
  const prev = SAMPLE_BY_PRESET.get(sample.backgroundPresetId)
  if (!prev || sample.id === sample.backgroundPresetId) SAMPLE_BY_PRESET.set(sample.backgroundPresetId, sample)
}

const OCCASION_ALIAS_ID = /^(day-thang|thoi-noi|sinh-nhat|mung-tho|khai-truong|tan-gia|lien-hoan|tot-nghiep|su-kien)-/

/** Demo của một loại thiệp. Cưới hiện cả kho nền, không chỉ 5 mẫu đầu. */
export function weddingOccasionDemos(raw: unknown): WeddingSampleCard[] {
  const key = normalizeInvitationOccasion(raw)
  if (key === 'wedding') {
    return WEDDING_SAMPLE_CARDS.filter((sample) => !OCCASION_ALIAS_ID.test(sample.id))
  }
  const ids = OCCASION_DEMO_IDS[key]
  return ids.flatMap((id) => {
    const sample = SAMPLE_BY_ID.get(id)
    return sample ? [sample] : []
  })
}

/** Ảnh nhỏ cho lưới chủ đề. File nằm ở public/wedding/sample-thumbs, tạo bằng scripts/build-wedding-sample-thumbs.ts. */
export function weddingSampleGalleryThumb(sample: Pick<WeddingSampleCard, 'id'>): string {
  return `/wedding/sample-thumbs/${sample.id}.webp`
}

/** Ảnh dài của thiệp đã mở. Ô mẫu hiện phần trên, đưa chuột vào thì trượt lên. Tạo bằng scripts/build-wedding-sample-scroll.ts. */
export function weddingSampleScrollStrip(sample: Pick<WeddingSampleCard, 'id'>): string {
  return `/wedding/sample-scroll/${sample.id}.webp`
}

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

/** Mẫu đang gắn trên thiệp. Nền có sẵn thắng kit, kit thắng ảnh kho còn sót. */
export function findWeddingSampleInUse(input: {
  backgroundPresetId?: string | null
  backgroundKitStyleId?: string | null
  masterImageUrl?: string | null
  occasionKey?: string | null
}): WeddingSampleCard | undefined {
  const presetId = input.backgroundPresetId?.trim() || ''
  const occasion = input.occasionKey ? normalizeInvitationOccasion(input.occasionKey) : ''
  if (presetId) {
    const hits = WEDDING_SAMPLE_CARDS.filter((sample) => !sample.libraryImageUrl && sample.backgroundPresetId === presetId)
    const preset = (occasion ? hits.find((sample) => normalizeInvitationOccasion(sample.occasionKey || 'wedding') === occasion) : undefined) ?? hits[0]
    if (preset) return preset
  }
  const kitId = input.backgroundKitStyleId?.trim() || ''
  if (kitId) {
    const kit = WEDDING_SAMPLE_CARDS.find(
      (sample) => !sample.libraryImageUrl && !sample.backgroundPresetId && sample.aiStyleId === kitId,
    )
    if (kit) return kit
  }
  const master = input.masterImageUrl?.trim() || ''
  if (!master) return undefined
  return WEDDING_SAMPLE_CARDS.find((sample) => sample.libraryImageUrl === master)
}

/** Mẫu đang dùng đứng đầu. Các mẫu khác giữ thứ tự kho. */
export function weddingSamplesWithActiveFirst(
  samples: readonly WeddingSampleCard[],
  activeId: string | null | undefined,
): WeddingSampleCard[] {
  const id = activeId?.trim() || ''
  if (!id) return [...samples]
  const index = samples.findIndex((sample) => sample.id === id)
  if (index <= 0) return [...samples]
  const next = [...samples]
  const [active] = next.splice(index, 1)
  return active ? [active, ...next] : next
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

/** Nền, khung, hoa và màu của mẫu, giữ chữ và ảnh thật của thiệp đang sửa. */
export function weddingSampleLookOnCard<T extends {
  sectionConfig: string
  groomImageUrl: string
  brideImageUrl: string
  albumImageUrls: string[]
}>(card: T, sample: WeddingSampleCard): (T & {
  selectedStyleId: string
  colorPalette: string
  plateUrls: string[]
  masterImageUrl: string | null
}) | null {
  const preset = sample.libraryImageUrl
    ? undefined
    : sample.aiStyleId
      ? weddingAiBackgroundKit(sample.aiStyleId)
      : findWeddingBackgroundPreset(sample.backgroundPresetId)
  if (!sample.libraryImageUrl && !preset) return null
  const styleId = sample.libraryImageUrl
    ? sample.aiStyleId || 'floral'
    : sample.aiStyleId || preset!.look.styleId
  const style = getWeddingStylePreset(styleId)
  const cleared = clearWeddingFrameChoice(clearWeddingFrameChoice(card.sectionConfig, 'cover'), 'pair')
  const patch = sample.libraryImageUrl
    ? weddingLibrarySampleSectionPatch(sample.aiStyleId, sample.id)
    : sample.aiStyleId
      ? weddingAiKitSectionPatch(sample.aiStyleId)
      : weddingReadyBackgroundSectionPatch(preset!)
  const visual = stripWeddingSamplePhotos({
    ...card,
    sectionConfig: mergeWeddingSectionConfig(cleared, patch),
  })
  const opened = withoutPrivateShell(parseWeddingSectionConfig(visual.sectionConfig))
  return {
    ...visual,
    sectionConfig: stringifyWeddingSectionConfig(opened),
    selectedStyleId: styleId,
    colorPalette: style.palette,
    plateUrls: sample.libraryImageUrl ? [sample.libraryImageUrl] : [...(preset?.plates ?? [])],
    masterImageUrl: sample.libraryImageUrl || null,
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
  const facts = weddingSampleDemoFacts(sample)
  const secondPerson = Boolean(facts.brideName.trim())
  return {
    id: `sample:${sample.id}`,
    userId: blank,
    slug: blank,
    occasionKey: normalizeInvitationOccasion(sample.occasionKey || 'wedding'),
    groomName: facts.groomName,
    brideName: facts.brideName,
    weddingDate: '2026-12-20',
    weddingTime: '17:00',
    partyStartTime: '18:00',
    venue: facts.venue,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facts.venue)}`,
    invitationText: facts.invitationText,
    invitationTextEn: facts.invitationTextEn,
    guestName: 'Anh Thanh',
    guestInviteVenue: '',
    storyText: facts.storyText,
    coupleIntro: facts.coupleIntro,
    loveQuote: facts.loveQuote,
    eventTimeline: facts.eventTimeline,
    dressCode: sample.dressCode || 'Trang phục lịch sự, tông kem, be hoặc nâu nhạt.',
    thankYouText: facts.thankYouText,
    sectionConfig: mergeWeddingSectionConfig('{}', {
      ...sectionPatch,
      coverPhotoUrl: sample.coverPhotoUrl,
      ...(typeof sample.coverPhotoPositionY === 'number' ? { coverPhotoPositionY: sample.coverPhotoPositionY } : {}),
      ...(typeof sample.coverPhotoPositionX === 'number' ? { coverPhotoPositionX: sample.coverPhotoPositionX } : {}),
      // Ảnh demo phong bì ngà chừa tường phía trên đầu. Kéo hai chân dung lên một chút.
      ...(sample.id === 'phong-bi-nga'
        ? {
            groomPhotoPositionX: 50,
            groomPhotoPositionY: 55,
            groomPhotoScale: 1.25,
            bridePhotoPositionX: 50,
            bridePhotoPositionY: 55,
            bridePhotoScale: 1.25,
          }
        : {}),
    }),
    albumImageUrls: [...sample.albumImageUrls],
    groomParents: facts.groomParents,
    brideParents: facts.brideParents,
    groomHometown: 'Hà Nội',
    brideHometown: secondPerson ? 'Hải Phòng' : blank,
    groomInviteAddress: facts.venue,
    groomInviteMapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facts.venue)}`,
    groomInviteReceptionTime: '17:00',
    groomInvitePartyStartTime: '18:00',
    brideInviteAddress: secondPerson ? 'Số 8 đường Lạch Tray, Ngô Quyền, Hải Phòng' : blank,
    brideInviteMapUrl: secondPerson ? 'https://www.google.com/maps/search/?api=1&query=8%20Lạch%20Tray%20Ngô%20Quyền%20Hải%20Phòng' : blank,
    brideInviteReceptionTime: secondPerson ? '10:30' : blank,
    brideInvitePartyStartTime: secondPerson ? '11:30' : blank,
    groomInviteWeddingDate: '2026-12-20',
    groomInviteText: blank,
    groomInviteTextEn: blank,
    groomInviteEventTimeline: facts.eventTimeline,
    groomInviteDressCode: blank,
    groomInviteContact: '0900 000 001',
    groomInviteCoverImageUrl: blank,
    groomInviteDefaultPersonalMessage: blank,
    groomInviteThankYouText: blank,
    brideInviteWeddingDate: secondPerson ? '2026-12-19' : blank,
    brideInviteText: blank,
    brideInviteTextEn: blank,
    brideInviteEventTimeline: secondPerson ? '10:30 | Đón khách nhà gái\n11:00 | Lễ gia tiên\n11:30 | Tiệc thân mật\n13:00 | Cảm ơn và chia tay' : blank,
    brideInviteDressCode: blank,
    brideInviteContact: secondPerson ? '0900 000 002' : blank,
    brideInviteCoverImageUrl: blank,
    brideInviteDefaultPersonalMessage: blank,
    brideInviteThankYouText: blank,
    groomImageUrl: sample.groomImageUrl,
    brideImageUrl: secondPerson ? sample.brideImageUrl : blank,
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
    groomGiftAccountName: facts.groomGiftAccountName,
    brideGiftBankId: secondPerson ? 'VCB' : blank,
    brideGiftAccountNo: secondPerson ? '9876543210' : blank,
    brideGiftAccountName: facts.brideGiftAccountName,
    isPublished: false,
    publishedAt: null,
    masterImageUrl: sample.libraryImageUrl || null,
    effectsEnabled: true,
  }
}
