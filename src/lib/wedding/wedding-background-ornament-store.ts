import { findWeddingBackgroundPreset, WEDDING_ORNAMENT_LIST_MAX, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import { WEDDING_STYLE_PRESETS } from '@/lib/wedding/wedding-style-presets'
import type { WebLocale } from '@/lib/i18n/config'

export type WeddingOrnamentPiece = {
  src: string
  label: Record<WebLocale, string>
}

const PIECE = (file: string, label: Record<WebLocale, string>): WeddingOrnamentPiece => ({
  src: `/wedding/backgrounds/ornaments/${file}`,
  label,
})

/** Ảnh hoa trong kho được phép gắn lên lớp nổi. Không nhận ảnh ngoài danh sách này. */
export const WEDDING_ORNAMENT_CATALOG: readonly WeddingOrnamentPiece[] = [
  PIECE('gold-heart.png', { vi: 'Tim vàng', en: 'Gold heart', zh: '金心', ja: '金のハート', ko: '금색 하트' }),
  PIECE('gold-heart-roses.png', { vi: 'Tim hoa hồng', en: 'Heart with roses', zh: '玫瑰金心', ja: 'バラのハート', ko: '장미 하트' }),
  PIECE('gold-hearts.png', { vi: 'Hai tim vàng', en: 'Two gold hearts', zh: '双金心', ja: '二つの金のハート', ko: '금색 하트 두 개' }),
  PIECE('gold-rose.png', { vi: 'Hoa hồng vàng', en: 'Gold rose', zh: '金玫瑰', ja: '金のバラ', ko: '금색 장미' }),
  PIECE('gold-rose-stem.png', { vi: 'Hồng có cành', en: 'Rose on a stem', zh: '带茎金玫瑰', ja: '茎つきの金のバラ', ko: '줄기 달린 금색 장미' }),
  PIECE('gold-rose-bud.png', { vi: 'Nụ hồng vàng', en: 'Gold rosebud', zh: '金玫瑰苞', ja: '金のつぼみ', ko: '금색 장미 봉오리' }),
  PIECE('gold-leaf.png', { vi: 'Lá vàng', en: 'Gold leaf', zh: '金叶', ja: '金の葉', ko: '금색 잎' }),
  PIECE('gold-leaf-sprig.png', { vi: 'Cành lá vàng', en: 'Gold leaf sprig', zh: '金叶枝', ja: '金の葉枝', ko: '금색 잎가지' }),
  PIECE('gold-vine.png', { vi: 'Dây lá vàng', en: 'Gold vine', zh: '金藤', ja: '金のつる', ko: '금색 덩굴' }),
  PIECE('gold-blossom.png', { vi: 'Hoa năm cánh', en: 'Gold blossom', zh: '金花', ja: '金の花', ko: '금색 꽃' }),
  PIECE('gold-peony.png', { vi: 'Mẫu đơn vàng', en: 'Gold peony', zh: '金牡丹', ja: '金の牡丹', ko: '금색 모란' }),
  PIECE('gold-flower-cluster.png', { vi: 'Chùm hoa vàng', en: 'Gold flower cluster', zh: '金花束', ja: '金の花束', ko: '금색 꽃다발' }),
  PIECE('dried-sprig.png', { vi: 'Cành hoa khô', en: 'Dried sprig', zh: '干花枝', ja: 'ドライフラワー', ko: '드라이 플라ワー' }),
  PIECE('dried-gyp-left.png', { vi: 'Baby nghiêng trái', en: 'Baby breath, left', zh: '左倾满天星', ja: '左向きカスミソウ', ko: '왼쪽 안개꽃' }),
  PIECE('dried-gyp-right.png', { vi: 'Baby nghiêng phải', en: 'Baby breath, right', zh: '右倾满天星', ja: '右向きカスミソウ', ko: '오른쪽 안개꽃' }),
  PIECE('dried-gyp-tall.png', { vi: 'Baby cao', en: 'Tall baby breath', zh: '高枝满天星', ja: '高いカスミソウ', ko: '긴 안개꽃' }),
  PIECE('dried-gyp-blush.png', { vi: 'Baby hồng phấn', en: 'Blush baby breath', zh: '粉满天星', ja: '淡いピンクのカスミソウ', ko: '분홍 안개꽃' }),
  PIECE('dried-gyp-tape.png', { vi: 'Baby dán băng', en: 'Taped baby breath', zh: '胶带满天星', ja: 'テープ付きカスミソウ', ko: '테이프 안개꽃' }),
  PIECE('dried-gyp-cloud.png', { vi: 'Bụi baby trắng', en: 'White baby breath cloud', zh: '白满天星团', ja: '白いカスミソウの房', ko: '하얀 안개꽃 뭉치' }),
  PIECE('dried-gyp-buds.png', { vi: 'Baby nụ', en: 'Baby breath buds', zh: '满天星花苞', ja: 'カスミソウのつぼみ', ko: '안개꽃 봉오리' }),
  PIECE('dried-straw.png', { vi: 'Hoa khô cam', en: 'Dried strawflowers', zh: '干麦秆菊', ja: '乾いたムギワラギク', ko: '말린 밀짚꽃' }),
  PIECE('dried-gyp-arch.png', { vi: 'Baby cong', en: 'Arched baby breath', zh: '弧形满天星', ja: '弧を描くカスミソウ', ko: '휘어진 안개꽃' }),
  PIECE('dried-gyp-pair.png', { vi: 'Hai cành baby', en: 'Two baby breath stems', zh: '两枝满天星', ja: '二本のカスミソウ', ko: '안개꽃 두 줄기' }),
  PIECE('garden-leaves.png', { vi: 'Lá vườn', en: 'Garden leaves', zh: '庭园叶', ja: '庭の葉', ko: '정원 잎' }),
  PIECE('garden-bloom.png', { vi: 'Hoa vườn', en: 'Garden bloom', zh: '庭园花', ja: '庭の花', ko: '정원 꽃' }),
  PIECE('garden-petal.png', { vi: 'Cánh hoa', en: 'Petal', zh: '花瓣', ja: '花びら', ko: '꽃잎' }),
  PIECE('moc-bloom.png', { vi: 'Mộc hoa trắng', en: 'White gardenia', zh: '白栀子', ja: '白いクチナシ', ko: '흰 치자' }),
  PIECE('moc-leaf.png', { vi: 'Cành lá mộc', en: 'Wood-leaf branch', zh: '木叶枝', ja: '木の葉枝', ko: '나뭇잎 가지' }),
  PIECE('moc-sprig.png', { vi: 'Nhài trắng', en: 'White jasmine', zh: '白茉莉', ja: '白いジャスミン', ko: '흰 자스민' }),
  PIECE('calla-stem.png', { vi: 'Hoa rum có lá', en: 'Calla with leaf', zh: '马蹄莲带叶', ja: '葉つきカラー', ko: '잎 달린 칼라' }),
  PIECE('calla-bloom.png', { vi: 'Hoa rum trắng', en: 'White calla', zh: '白马蹄莲', ja: '白いカラー', ko: '흰 칼라' }),
  PIECE('mist-sprig.png', { vi: 'Baby trắng', en: 'White baby breath', zh: '白满天星', ja: '白いカスミソウ', ko: '흰 안개꽃' }),
  PIECE('peony-bloom.png', { vi: 'Mẫu đơn', en: 'Peony', zh: '牡丹', ja: '牡丹', ko: '모란' }),
  PIECE('peony-leaf.png', { vi: 'Lá mẫu đơn', en: 'Peony leaf', zh: '牡丹叶', ja: '牡丹の葉', ko: '모란 잎' }),
  PIECE('tre-canh.png', { vi: 'Cành tre', en: 'Bamboo branch', zh: '竹枝', ja: '竹の枝', ko: '대나무 가지' }),
  PIECE('tre-hoa.png', { vi: 'Hoa tre', en: 'Bamboo blossom', zh: '竹花', ja: '竹の花', ko: '대나무 꽃' }),
  PIECE('dao-canh.png', { vi: 'Cành đào', en: 'Peach branch', zh: '桃枝', ja: '桃の枝', ko: '복숭아 가지' }),
  PIECE('dao-nu.png', { vi: 'Nụ đào', en: 'Peach buds', zh: '桃蕾', ja: '桃のつぼみ', ko: '복숭아 봉오리' }),
  PIECE('bien-vo.png', { vi: 'Vỏ sò', en: 'Scallop shell', zh: '扇贝', ja: 'ホタテの殻', ko: '가리비 껍데기' }),
  PIECE('bien-co.png', { vi: 'Cỏ biển', en: 'Beach grass', zh: '海滩草', ja: '浜草', ko: '해변 풀' }),
  PIECE('dem-canh.png', { vi: 'Cành ô liu', en: 'Olive sprig', zh: '橄榄枝', ja: 'オリーブの枝', ko: '올리브 가지' }),
  PIECE('dem-hoa.png', { vi: 'Hoa kem', en: 'Cream blossoms', zh: '奶油小花', ja: 'クリーム色の小花', ko: '크림 꽃' }),
  PIECE('lua-dai.png', { vi: 'Dải lụa', en: 'Silk ribbon', zh: '丝绸带', ja: '絹のリボン', ko: '실크 리본' }),
  PIECE('lua-hoa.png', { vi: 'Hoa nhài', en: 'Jasmine', zh: '茉莉', ja: 'ジャスミン', ko: '자스민' }),
  PIECE('do-dam-peony.png', { vi: 'Mẫu đơn đỏ rượu', en: 'Burgundy peony', zh: '酒红牡丹', ja: 'ワイン色の牡丹', ko: '버건디 모란' }),
  PIECE('do-dam-rose.png', { vi: 'Hồng kem', en: 'Cream rose', zh: '奶油玫瑰', ja: 'クリームのバラ', ko: '크림 장미' }),
  PIECE('do-dam-stem.png', { vi: 'Baby rượu', en: 'Burgundy baby breath', zh: '酒红满天星', ja: 'ワイン色のカスミソウ', ko: '버건디 안개꽃' }),
  PIECE('scarlet-sprig.png', { vi: 'Cành đỏ', en: 'Scarlet sprig', zh: '红枝', ja: '赤い枝', ko: '붉은 가지' }),
  PIECE('lotus-bloom.png', { vi: 'Sen', en: 'Lotus', zh: '莲花', ja: '蓮', ko: '연꽃' }),
  PIECE('lotus-leaf.png', { vi: 'Lá sen', en: 'Lotus leaf', zh: '莲叶', ja: '蓮の葉', ko: '연잎' }),
  PIECE('pearl-rose.png', { vi: 'Hồng ngọc', en: 'Pearl rose', zh: '珍珠玫瑰', ja: 'パールローズ', ko: '펄 장미' }),
  PIECE('pearl-butterfly.png', { vi: 'Bướm hồng', en: 'Blush butterfly', zh: '粉蝶', ja: 'ピンクの蝶', ko: '분홍 나비' }),
  PIECE('butterfly-blush.png', { vi: 'Bướm cánh hồng', en: 'Pink butterfly', zh: '粉红蝶', ja: '開いたピンクの蝶', ko: '활짝 핀 분홍 나비' }),
  PIECE('butterfly-pearl.png', { vi: 'Bướm trắng', en: 'White butterfly', zh: '白蝶', ja: '白い蝶', ko: '흰 나비' }),
  PIECE('butterfly-rose.png', { vi: 'Bướm đào', en: 'Peach butterfly', zh: '桃粉蝶', ja: '桃の蝶', ko: '복숭아 나비' }),
  PIECE('butterfly-ivory.png', { vi: 'Bướm ngà', en: 'Ivory butterfly', zh: '象牙蝶', ja: '象牙色の蝶', ko: '아이보리 나비' }),
  PIECE('butterfly-lilac.png', { vi: 'Bướm tím', en: 'Lilac butterfly', zh: '紫蝶', ja: '紫の蝶', ko: '라일락 나비' }),
  PIECE('butterfly-lilac-mirror.png', { vi: 'Bướm tím lật', en: 'Lilac butterfly, flipped', zh: '紫蝶翻转', ja: '左向きの紫の蝶', ko: '왼쪽 라일락 나비' }),
  PIECE('butterfly-lilac-open.png', { vi: 'Bướm tím đối xứng', en: 'Symmetric lilac butterfly', zh: '对称紫蝶', ja: '左右対称の紫の蝶', ko: '대칭 라일락 나비' }),
  PIECE('butterfly-sage.png', { vi: 'Bướm rêu', en: 'Sage butterfly', zh: '苔绿蝶', ja: '苔色の蝶', ko: '세이지 나비' }),
  PIECE('butterfly-sage-mirror.png', { vi: 'Bướm rêu lật', en: 'Sage butterfly, flipped', zh: '苔绿蝶翻转', ja: '左向きの苔色の蝶', ko: '왼쪽 세이지 나비' }),
  PIECE('butterfly-sage-open.png', { vi: 'Bướm rêu đối xứng', en: 'Symmetric sage butterfly', zh: '对称苔绿蝶', ja: '左右対称の苔色の蝶', ko: '대칭 세이지 나비' }),
  PIECE('butterfly-mist.png', { vi: 'Bướm xanh khói', en: 'Mist butterfly', zh: '雾蓝蝶', ja: '霧青の蝶', ko: '안개색 나비' }),
  PIECE('butterfly-mist-mirror.png', { vi: 'Bướm xanh khói lật', en: 'Mist butterfly, flipped', zh: '雾蓝蝶翻转', ja: '左向きの霧青の蝶', ko: '왼쪽 안개색 나비' }),
  PIECE('butterfly-mist-open.png', { vi: 'Bướm xanh khói đối xứng', en: 'Symmetric mist butterfly', zh: '对称雾蓝蝶', ja: '左右対称の霧青の蝶', ko: '대칭 안개색 나비' }),
  PIECE('pearl-strand.png', { vi: 'Chuỗi ngọc', en: 'Pearl strand', zh: '珍珠链', ja: 'パールの連', ko: '진주 줄' }),
]

const CATALOG_SRC = new Set(WEDDING_ORNAMENT_CATALOG.map((piece) => piece.src))

/** Ảnh hoa trong kho, hoặc link ảnh tải lên / dán từ ngoài. */
export function isWeddingOrnamentImageSrc(src: string): boolean {
  const value = src.trim()
  if (CATALOG_SRC.has(value)) return true
  if (value.startsWith('/wedding/backgrounds/ornaments/') && value.length < 300 && !value.includes('..')) return true
  if (value.length < 12 || value.length > 2000) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  return /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(url.pathname)
}

const ORNAMENT_EDITOR_EMAILS = new Set(['dev@local.test'])
const CARD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Quản trị, và tài khoản dev local, được sửa lớp hoa dùng chung khi thiệp chưa có bản riêng. */
export function canEditWeddingOrnaments(input: { role?: string | null; email?: string | null }): boolean {
  if (input.role === 'admin') return true
  const email = input.email?.trim().toLowerCase() || ''
  return ORNAMENT_EDITOR_EMAILS.has(email)
}

/** Chủ thiệp sửa hoa của thiệp mình. Quản trị sửa thì ghi mẫu chung cho khách chưa có bản riêng. */
export function canEditWeddingCardOrnaments(input: {
  role?: string | null
  email?: string | null
  userId?: string | null
  ownerId?: string | null
}): boolean {
  if (canEditWeddingOrnaments({ role: input.role, email: input.email })) return true
  const userId = input.userId?.trim() || ''
  const ownerId = input.ownerId?.trim() || ''
  return Boolean(userId && ownerId && userId === ownerId)
}

export function weddingCardOrnamentLayoutKey(cardId: string): string {
  const id = cardId.trim()
  if (!CARD_ID_RE.test(id)) return ''
  return `card:${id}`
}

export type WeddingOrnamentDevice = 'desktop' | 'mobile'

/** Vỏ thiệp là một khổ. Nội dung là trang dài. Hai mặt không dùng chung bản hoa. */
export type WeddingOrnamentSurface = 'cover' | 'letter'

export function isWeddingOrnamentSurface(value: string): value is WeddingOrnamentSurface {
  return value === 'cover' || value === 'letter'
}

/** Quản trị ghi khóa nền dùng chung. Khách, hoặc khi nền không có khóa chung, ghi khóa của đúng thiệp. */
export function weddingOrnamentSaveKey(input: {
  templateEditor: boolean
  cardId: string
  device: WeddingOrnamentDevice
  sharedBaseKey: string
  surface: WeddingOrnamentSurface
}): string {
  if (!isWeddingOrnamentSurface(input.surface)) return ''
  if (input.templateEditor) {
    const shared = weddingOrnamentSurfaceKey(input.sharedBaseKey, input.device, input.surface)
    if (shared && isWeddingOrnamentLayoutKey(shared)) return shared
  }
  return weddingOrnamentSurfaceKey(weddingCardOrnamentLayoutKey(input.cardId), input.device, input.surface)
}

export function weddingOrnamentDeviceKey(baseKey: string, device: WeddingOrnamentDevice): string {
  return baseKey ? `${baseKey}@${device}` : ''
}

/** Khóa hoa của một mặt. Vỏ và nội dung không đọc khóa của nhau. */
export function weddingOrnamentSurfaceKey(
  baseKey: string,
  device: WeddingOrnamentDevice,
  surface: WeddingOrnamentSurface,
): string {
  const deviceKey = weddingOrnamentDeviceKey(baseKey, device)
  if (!deviceKey || !isWeddingOrnamentSurface(surface)) return ''
  return `${deviceKey}@${surface}`
}

export function splitWeddingOrnamentLayoutKey(key: string): {
  base: string
  device: WeddingOrnamentDevice | null
  surface: WeddingOrnamentSurface | null
} {
  let surface: WeddingOrnamentSurface | null = null
  let rest = key
  if (rest.endsWith('@cover')) {
    surface = 'cover'
    rest = rest.slice(0, -'@cover'.length)
  } else if (rest.endsWith('@letter')) {
    surface = 'letter'
    rest = rest.slice(0, -'@letter'.length)
  }
  if (rest.endsWith('@desktop')) return { base: rest.slice(0, -'@desktop'.length), device: 'desktop', surface }
  if (rest.endsWith('@mobile')) return { base: rest.slice(0, -'@mobile'.length), device: 'mobile', surface }
  return { base: rest, device: null, surface }
}

function isWeddingKitStyleId(styleId: string): boolean {
  return WEDDING_STYLE_PRESETS.some((preset) => preset.id === styleId)
}

/** Nền có sẵn dùng chung một khóa. Chủ đề AI dùng chung một khóa cho mọi khách của chủ đề đó. */
export function weddingOrnamentLayoutKey(input: {
  backgroundPresetId?: string | null
  backgroundKitStyleId?: string | null
  masterImageUrl?: string | null
}): string {
  const preset = input.backgroundPresetId?.trim() || ''
  if (preset && findWeddingBackgroundPreset(preset)) return `preset:${preset}`
  const style = input.backgroundKitStyleId?.trim() || ''
  if (style && isWeddingKitStyleId(style)) return `kit:${style}`
  const url = input.masterImageUrl?.trim() || ''
  if (!url || url.length > 2000) return ''
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/wedding/')) return ''
  return `image:${url}`
}

export function isWeddingOrnamentLayoutKey(key: string): boolean {
  const { base } = splitWeddingOrnamentLayoutKey(key.trim())
  if (base.startsWith('preset:')) {
    return weddingOrnamentLayoutKey({ backgroundPresetId: base.slice('preset:'.length) }) === base
  }
  if (base.startsWith('kit:')) {
    return weddingOrnamentLayoutKey({ backgroundKitStyleId: base.slice('kit:'.length) }) === base
  }
  if (base.startsWith('image:')) {
    return weddingOrnamentLayoutKey({ masterImageUrl: base.slice('image:'.length) }) === base
  }
  if (base.startsWith('card:')) return weddingCardOrnamentLayoutKey(base.slice('card:'.length)) === base
  return false
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** null khi danh sách không hợp lệ. Mảng rỗng là quản trị đã xóa hết hoa. */
export function parseWeddingOrnamentList(value: unknown): WeddingBackgroundOrnament[] | null {
  if (!Array.isArray(value) || value.length > WEDDING_ORNAMENT_LIST_MAX) return null
  const items: WeddingBackgroundOrnament[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null
    const record = raw as Record<string, unknown>
    const src = typeof record.src === 'string' ? record.src.trim() : ''
    if (!isWeddingOrnamentImageSrc(src)) return null
    const x = Number(record.x)
    const y = Number(record.y)
    const w = Number(record.w)
    if (![x, y, w].every(Number.isFinite)) return null
    if (x < -40 || x > 110 || y < -40 || y > 110 || w < 8 || w > 90) return null
    const item: WeddingBackgroundOrnament = { src, x: round1(x), y: round1(y), w: round1(w) }
    if (record.rotate != null && record.rotate !== '') {
      const rotate = Number(record.rotate)
      if (!Number.isFinite(rotate) || rotate < -180 || rotate > 180) return null
      item.rotate = Math.round(rotate)
    }
    if (record.flipX === true) item.flipX = true
    if (record.opacity != null && record.opacity !== '') {
      const opacity = Number(record.opacity)
      if (!Number.isFinite(opacity) || opacity < 0.15 || opacity > 1) return null
      item.opacity = round1(opacity)
    }
    if (record.blur != null && record.blur !== '') {
      const blur = Number(record.blur)
      if (!Number.isFinite(blur) || blur < 0 || blur > 12) return null
      if (blur > 0) item.blur = Math.round(blur)
    }
    if (record.fade != null && record.fade !== '') {
      const fade = Number(record.fade)
      if (!Number.isFinite(fade) || fade < 0 || fade > 1) return null
      if (fade > 0) item.fade = round1(fade)
    }
    if (record.anchor === 'bottom') item.anchor = 'bottom'
    if (record.motion != null && record.motion !== '' && record.motion !== 'still') {
      if (record.motion !== 'rise') return null
      item.motion = 'rise'
    }
    items.push(item)
  }
  return items
}

export function weddingOrnamentsForDevice(
  defaults: readonly WeddingBackgroundOrnament[] | undefined,
  layouts: Record<string, WeddingBackgroundOrnament[]>,
  baseKey: string,
  device: WeddingOrnamentDevice,
  surface: WeddingOrnamentSurface = 'cover',
): WeddingBackgroundOrnament[] {
  const exact = weddingOrnamentSurfaceKey(baseKey, device, surface)
  if (exact && Object.prototype.hasOwnProperty.call(layouts, exact)) return layouts[exact]
  if (surface === 'letter') return [...(defaults ?? [])]
  const deviceKey = weddingOrnamentDeviceKey(baseKey, device)
  if (deviceKey && Object.prototype.hasOwnProperty.call(layouts, deviceKey)) return layouts[deviceKey]
  return weddingOrnamentsForKey(defaults, layouts, baseKey)
}

export function weddingOrnamentsForKey(
  defaults: readonly WeddingBackgroundOrnament[] | undefined,
  layouts: Record<string, WeddingBackgroundOrnament[]>,
  key: string,
): WeddingBackgroundOrnament[] {
  if (key && Object.prototype.hasOwnProperty.call(layouts, key)) return layouts[key]
  return [...(defaults ?? [])]
}

function sheetFromLayouts(
  layouts: Record<string, WeddingBackgroundOrnament[]>,
  key: string,
): WeddingBackgroundOrnament[] | null {
  if (!key || !Object.prototype.hasOwnProperty.call(layouts, key)) return null
  return layouts[key]
}

/**
 * Quản trị xem mẫu chung của đúng mặt. Khách có bản riêng thì xem bản đó, kể cả khi đã xóa hết.
 * Không có bản riêng thì mẫu của đúng mặt, rồi hoa mặc định của nền.
 * Bản cũ không ghi mặt chỉ còn là lối đọc của vỏ, không đưa sang nội dung.
 */
export function resolveWeddingShownOrnaments(input: {
  defaults?: readonly WeddingBackgroundOrnament[] | null
  cardSheet?: readonly WeddingBackgroundOrnament[] | null
  sharedSheet?: readonly WeddingBackgroundOrnament[] | null
  sharedBase?: readonly WeddingBackgroundOrnament[] | null
  templateEditor?: boolean
}): WeddingBackgroundOrnament[] {
  if (!input.templateEditor && input.cardSheet) return input.cardSheet as WeddingBackgroundOrnament[]
  if (input.sharedSheet) return input.sharedSheet as WeddingBackgroundOrnament[]
  if (input.sharedBase) return input.sharedBase as WeddingBackgroundOrnament[]
  return (input.defaults ?? []).map((item) => ({ ...item }))
}

function firstOrnamentSheet(
  layouts: Record<string, WeddingBackgroundOrnament[]>,
  keys: readonly string[],
): WeddingBackgroundOrnament[] | null {
  for (const key of keys) {
    const sheet = sheetFromLayouts(layouts, key)
    if (sheet) return sheet
  }
  return null
}

/** Đọc hoa của một mặt. Vỏ không đọc khóa nội dung. Nội dung không đọc khóa vỏ, kể cả bản cũ chưa ghi mặt. */
export function resolveWeddingCardOrnaments(input: {
  defaults?: readonly WeddingBackgroundOrnament[] | null
  layouts: Record<string, WeddingBackgroundOrnament[]>
  sharedBaseKey: string
  cardId: string
  device: WeddingOrnamentDevice
  surface: WeddingOrnamentSurface
  templateEditor: boolean
}): WeddingBackgroundOrnament[] {
  const cardBase = weddingCardOrnamentLayoutKey(input.cardId)
  const cardKeys = [weddingOrnamentSurfaceKey(cardBase, input.device, input.surface)]
  const sharedKeys = [weddingOrnamentSurfaceKey(input.sharedBaseKey, input.device, input.surface)]
  const baseKeys: string[] = []
  if (input.surface === 'cover') {
    cardKeys.push(weddingOrnamentDeviceKey(cardBase, input.device))
    sharedKeys.push(weddingOrnamentDeviceKey(input.sharedBaseKey, input.device))
    baseKeys.push(input.sharedBaseKey)
  }
  return resolveWeddingShownOrnaments({
    defaults: input.defaults,
    cardSheet: firstOrnamentSheet(input.layouts, cardKeys),
    sharedSheet: firstOrnamentSheet(input.layouts, sharedKeys),
    sharedBase: firstOrnamentSheet(input.layouts, baseKeys),
    templateEditor: input.templateEditor,
  })
}

function sameOrnamentMark(a: WeddingBackgroundOrnament, b: WeddingBackgroundOrnament): boolean {
  return (
    a.src === b.src &&
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    (a.rotate ?? null) === (b.rotate ?? null) &&
    (a.flipX ?? false) === (b.flipX ?? false) &&
    (a.opacity ?? null) === (b.opacity ?? null) &&
    (a.blur ?? null) === (b.blur ?? null) &&
    (a.fade ?? null) === (b.fade ?? null) &&
    (a.anchor ?? 'top') === (b.anchor ?? 'top') &&
    (a.motion ?? 'still') === (b.motion ?? 'still')
  )
}

/** null khác mảng rỗng: rỗng là đã xóa hoa, null là chưa có bản để hiện. */
export function weddingOrnamentListsEqual(
  a: readonly WeddingBackgroundOrnament[] | null | undefined,
  b: readonly WeddingBackgroundOrnament[] | null | undefined,
): boolean {
  if (a == null || b == null) return a == null && b == null
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) {
    if (!sameOrnamentMark(a[index], b[index])) return false
  }
  return true
}
