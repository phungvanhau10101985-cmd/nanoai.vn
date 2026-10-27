import { findWeddingBackgroundPreset, type WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'
import type { WebLocale } from '@/lib/i18n/config'

export type WeddingOrnamentPiece = {
  src: string
  label: Record<WebLocale, string>
}

const PIECE = (file: string, label: Record<WebLocale, string>): WeddingOrnamentPiece => ({
  src: `/wedding/backgrounds/ornaments/${file}`,
  label,
})

/** Ảnh hoa màu nước được phép gắn lên lớp nổi. Không nhận ảnh ngoài danh sách này. */
export const WEDDING_ORNAMENT_CATALOG: readonly WeddingOrnamentPiece[] = [
  PIECE('garden-leaves.png', { vi: 'Lá vườn', en: 'Garden leaves', zh: '庭园叶', ja: '庭の葉', ko: '정원 잎' }),
  PIECE('garden-bloom.png', { vi: 'Hoa vườn', en: 'Garden bloom', zh: '庭园花', ja: '庭の花', ko: '정원 꽃' }),
  PIECE('garden-petal.png', { vi: 'Cánh hoa', en: 'Petal', zh: '花瓣', ja: '花びら', ko: '꽃잎' }),
  PIECE('peony-bloom.png', { vi: 'Mẫu đơn', en: 'Peony', zh: '牡丹', ja: '牡丹', ko: '모란' }),
  PIECE('peony-leaf.png', { vi: 'Lá mẫu đơn', en: 'Peony leaf', zh: '牡丹叶', ja: '牡丹の葉', ko: '모란 잎' }),
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

/** Quản trị ghi khóa nền dùng chung. Khách, hoặc khi nền không có khóa chung, ghi khóa của đúng thiệp. */
export function weddingOrnamentSaveKey(input: {
  templateEditor: boolean
  cardId: string
  device: WeddingOrnamentDevice
  sharedBaseKey: string
}): string {
  if (input.templateEditor) {
    const shared = weddingOrnamentDeviceKey(input.sharedBaseKey, input.device)
    if (shared && isWeddingOrnamentLayoutKey(shared)) return shared
  }
  return weddingOrnamentDeviceKey(weddingCardOrnamentLayoutKey(input.cardId), input.device)
}

export function weddingOrnamentDeviceKey(baseKey: string, device: WeddingOrnamentDevice): string {
  return baseKey ? `${baseKey}@${device}` : ''
}

export function splitWeddingOrnamentLayoutKey(key: string): { base: string; device: WeddingOrnamentDevice | null } {
  if (key.endsWith('@desktop')) return { base: key.slice(0, -'@desktop'.length), device: 'desktop' }
  if (key.endsWith('@mobile')) return { base: key.slice(0, -'@mobile'.length), device: 'mobile' }
  return { base: key, device: null }
}

export function weddingOrnamentLayoutKey(input: {
  backgroundPresetId?: string | null
  masterImageUrl?: string | null
}): string {
  const preset = input.backgroundPresetId?.trim() || ''
  if (preset && findWeddingBackgroundPreset(preset)) return `preset:${preset}`
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
  if (!Array.isArray(value) || value.length > 24) return null
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
    items.push(item)
  }
  return items
}

export function weddingOrnamentsForDevice(
  defaults: readonly WeddingBackgroundOrnament[] | undefined,
  layouts: Record<string, WeddingBackgroundOrnament[]>,
  baseKey: string,
  device: WeddingOrnamentDevice,
): WeddingBackgroundOrnament[] {
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
