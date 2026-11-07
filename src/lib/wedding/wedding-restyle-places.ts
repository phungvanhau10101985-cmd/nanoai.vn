import type { WebLocale } from '@/lib/i18n/config'

export type WeddingRestylePlace = {
  id: string
  region: 'vietnam' | 'world'
  label: Record<WebLocale, string>
  /** Cảnh gửi vào prompt. Không có chữ trên ảnh. */
  scene: string
}

const PLACE_ID = /^[a-z0-9-]{1,40}$/

export const WEDDING_RESTYLE_PLACES: readonly WeddingRestylePlace[] = [
  {
    id: 'ha-long',
    region: 'vietnam',
    label: { vi: 'Vịnh Hạ Long', en: 'Ha Long Bay', zh: '下龙湾', ja: 'ハロン湾', ko: '하롱베이' },
    scene: 'Ha Long Bay, Vietnam. Calm green water and real limestone karst islands in soft daylight. One small wooden boat far away. No painted rocks.',
  },
  {
    id: 'hoi-an',
    region: 'vietnam',
    label: { vi: 'Phố cổ Hội An', en: 'Hoi An old town', zh: '会安古镇', ja: 'ホイアン旧市街', ko: '호이안 옛거리' },
    scene: 'Hoi An ancient town, Vietnam. Yellow old houses, a quiet river, and a few silk lanterns in warm late-afternoon light. No shop signs readable as text.',
  },
  {
    id: 'sapa',
    region: 'vietnam',
    label: { vi: 'Ruộng Sa Pa', en: 'Sapa rice terraces', zh: '沙坝梯田', ja: 'サパの棚田', ko: '사파 계단식 논' },
    scene: 'Sapa, Vietnam. Real rice terraces stepping down a misty mountain, wet green grass, soft cloud light.',
  },
  {
    id: 'ninh-binh',
    region: 'vietnam',
    label: { vi: 'Tam Cốc', en: 'Tam Coc', zh: '三谷', ja: 'タムコック', ko: '탐꼭' },
    scene: 'Tam Coc, Ninh Binh, Vietnam. A still river between real limestone cliffs and rice fields, a small wooden boat far behind the people.',
  },
  {
    id: 'da-lat',
    region: 'vietnam',
    label: { vi: 'Hồ Xuân Hương', en: 'Xuan Huong Lake', zh: '春香湖', ja: 'スアンフオン湖', ko: '쑤언흐엉 호수' },
    scene: 'Xuan Huong Lake, Da Lat, Vietnam. A still lake, pine trees, and soft highland morning light. No readable signs.',
  },
  {
    id: 'hue',
    region: 'vietnam',
    label: { vi: 'Đại Nội Huế', en: 'Hue citadel', zh: '顺化京城', ja: 'フエの王宮', ko: '후에 왕궁' },
    scene: 'Hue imperial garden, Vietnam. Old yellow walls, a still lotus pond, and warm courtyard light. No flags with readable text.',
  },
  {
    id: 'hoan-kiem',
    region: 'vietnam',
    label: { vi: 'Hồ Hoàn Kiếm', en: 'Hoan Kiem Lake', zh: '还剑湖', ja: 'ホアンキエム湖', ko: '호안끼엠 호수' },
    scene: 'Hoan Kiem Lake, Hanoi. Still water, the red wooden bridge small in the distance, morning mist, real trees.',
  },
  {
    id: 'phu-quoc',
    region: 'vietnam',
    label: { vi: 'Bãi Sao', en: 'Sao Beach', zh: '星滩', ja: 'サオビーチ', ko: '사오 해변' },
    scene: 'Sao Beach, Phu Quoc, Vietnam. Pale sand, clear shallow water, and a few real casuarina trees. Soft daylight.',
  },
  {
    id: 'mui-ne',
    region: 'vietnam',
    label: { vi: 'Đồi cát Mũi Né', en: 'Mui Ne dunes', zh: '美奈沙丘', ja: 'ムイネーの砂丘', ko: '무이네 모래언덕' },
    scene: 'Mui Ne sand dunes, Vietnam. Warm gold sand ridges and a strip of sea far away, late-afternoon light.',
  },
  {
    id: 'ma-pi-leng',
    region: 'vietnam',
    label: { vi: 'Mã Pí Lèng', en: 'Ma Pi Leng pass', zh: '马皮冷山口', ja: 'マーピーレン峠', ko: '마피렝 고개' },
    scene: 'Ma Pi Leng pass, Ha Giang, Vietnam. A real mountain road high above a deep green river valley, clear highland light.',
  },
  {
    id: 'con-dao',
    region: 'vietnam',
    label: { vi: 'Côn Đảo', en: 'Con Dao', zh: '昆仑岛', ja: 'コンダオ', ko: '꼰다오' },
    scene: 'Con Dao, Vietnam. A quiet bay, dark green island hills, and pale clear water. No boats close to the people.',
  },
  {
    id: 'fansipan',
    region: 'vietnam',
    label: { vi: 'Fansipan', en: 'Fansipan', zh: '番西邦', ja: 'ファンシパン', ko: '판시판' },
    scene: 'Fansipan ridge, Vietnam. A real stone terrace above a sea of clouds, cool morning light, distant peaks.',
  },
  {
    id: 'paris',
    region: 'world',
    label: { vi: 'Paris', en: 'Paris', zh: '巴黎', ja: 'パリ', ko: '파리' },
    scene: 'Paris. A gravel garden and pale stone, the Eiffel Tower small and far, soft daylight. No readable signs.',
  },
  {
    id: 'santorini',
    region: 'world',
    label: { vi: 'Santorini', en: 'Santorini', zh: '圣托里尼', ja: 'サントリーニ', ko: '산토리니' },
    scene: 'Santorini. Whitewashed walls, one blue dome, and the Aegean sea below, late-afternoon light. No shop signs.',
  },
  {
    id: 'venice',
    region: 'world',
    label: { vi: 'Venice', en: 'Venice', zh: '威尼斯', ja: 'ベネチア', ko: '베네치아' },
    scene: 'Venice. A quiet canal, old stone, and a small arched bridge, morning light on the water. No readable shop names.',
  },
  {
    id: 'kyoto',
    region: 'world',
    label: { vi: 'Kyoto', en: 'Kyoto', zh: '京都', ja: '京都', ko: '교토' },
    scene: 'Kyoto. A real bamboo grove with tall green culms and filtered daylight. No torii piled up, no readable signs.',
  },
  {
    id: 'bali',
    region: 'world',
    label: { vi: 'Bali', en: 'Bali', zh: '巴厘岛', ja: 'バリ', ko: '발리' },
    scene: 'Bali. Real rice terraces, a frangipani tree, and warm humid daylight. No temple crowd.',
  },
  {
    id: 'maldives',
    region: 'world',
    label: { vi: 'Maldives', en: 'Maldives', zh: '马尔代夫', ja: 'モルディブ', ko: '몰디브' },
    scene: 'The Maldives. Pale sand, still turquoise water, and a wooden deck far behind. Soft daylight, no logo.',
  },
  {
    id: 'amalfi',
    region: 'world',
    label: { vi: 'Amalfi', en: 'Amalfi', zh: '阿马尔菲', ja: 'アマルフィ', ko: '아말피' },
    scene: 'The Amalfi coast. A cliff of pale houses, lemon trees, and deep blue sea, afternoon light.',
  },
  {
    id: 'swiss-alps',
    region: 'world',
    label: { vi: 'Dãy Alps', en: 'Swiss Alps', zh: '瑞士阿尔卑斯', ja: 'スイスアルプス', ko: '스위스 알프스' },
    scene: 'A Swiss alpine lake. Still water, a green meadow, and snow peaks far away, clear daylight.',
  },
  {
    id: 'petra',
    region: 'world',
    label: { vi: 'Petra', en: 'Petra', zh: '佩特拉', ja: 'ペトラ', ko: '페트라' },
    scene: 'Petra. A narrow sandstone canyon with warm rose stone and a slice of sky, late light. No crowds.',
  },
  {
    id: 'taj-mahal',
    region: 'world',
    label: { vi: 'Taj Mahal', en: 'Taj Mahal', zh: '泰姬陵', ja: 'タージマハル', ko: '타지마할' },
    scene: 'The Taj Mahal at dawn. A long reflecting pool, white marble far behind the people, pale sky. No crowds.',
  },
  {
    id: 'great-wall',
    region: 'world',
    label: { vi: 'Vạn Lý Trường Thành', en: 'Great Wall', zh: '长城', ja: '万里の長城', ko: '만리장성' },
    scene: 'The Great Wall of China. A stone ridge in mist, real bricks and mountains, cool morning light. No banners.',
  },
  {
    id: 'prague',
    region: 'world',
    label: { vi: 'Prague', en: 'Prague', zh: '布拉格', ja: 'プラハ', ko: '프라하' },
    scene: 'Prague at dawn. Charles Bridge stone, the river, and soft city roofs far away. No readable signs.',
  },
  {
    id: 'cappadocia',
    region: 'world',
    label: { vi: 'Cappadocia', en: 'Cappadocia', zh: '卡帕多奇亚', ja: 'カッパドキア', ko: '카파도키아' },
    scene: 'Cappadocia at dawn. Pale stone valleys and a few distant hot-air balloons, warm low light.',
  },
  {
    id: 'sydney',
    region: 'world',
    label: { vi: 'Sydney', en: 'Sydney', zh: '悉尼', ja: 'シドニー', ko: '시드니' },
    scene: 'Sydney Harbour. Calm water in front, the opera shells and bridge small and far, clear daylight.',
  },
]

const PLACE_BY_ID = new Map(WEDDING_RESTYLE_PLACES.map((place) => [place.id, place]))

export function findWeddingRestylePlace(id: string | null | undefined): WeddingRestylePlace | null {
  const key = (id || '').trim()
  if (!PLACE_ID.test(key)) return null
  return PLACE_BY_ID.get(key) ?? null
}

export function weddingRestylePlaceLabel(place: WeddingRestylePlace, locale: WebLocale): string {
  return place.label[locale] || place.label.en
}
