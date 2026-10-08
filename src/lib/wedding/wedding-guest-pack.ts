/** Một dòng khách mời = một link. Nhà trai và nhà gái mỗi bên một gói, cùng bảng giá. */

export const WEDDING_GUEST_FREE_CAP = 3

export type WeddingGuestPackSide = 'groom' | 'bride'

export type WeddingGuestPackLimitCode = 'guest_pack_limit_groom' | 'guest_pack_limit_bride'

export const WEDDING_GUEST_PACKS = [
  { id: 'p50', label: 'Tối đa 50 khách', cap: 50, priceVnd: 149_000 },
  { id: 'p100', label: 'Tối đa 100 khách', cap: 100, priceVnd: 199_000 },
  { id: 'unlimited', label: 'Không giới hạn', cap: null, priceVnd: 299_000 },
] as const

export type WeddingGuestPackId = (typeof WEDDING_GUEST_PACKS)[number]['id']

export type WeddingGuestPackOffer = {
  id: WeddingGuestPackId
  label: string
  guestCap: number | null
  listPriceVnd: number
  payVnd: number
  available: boolean
  current: boolean
}

export type WeddingGuestPackQuota = {
  packId: WeddingGuestPackId | null
  guestCount: number
  guestCap: number | null
  remaining: number | null
  offers: WeddingGuestPackOffer[]
}

export function parseWeddingGuestPackId(value: unknown): WeddingGuestPackId | null {
  const raw = String(value ?? '').trim()
  if (raw === 'p50' || raw === 'p100' || raw === 'unlimited') return raw
  return null
}

export function weddingGuestPackById(id: WeddingGuestPackId) {
  const pack = WEDDING_GUEST_PACKS.find((item) => item.id === id)
  if (!pack) throw new Error(`Unknown wedding guest pack: ${id}`)
  return pack
}

export function weddingGuestPackRank(packId: WeddingGuestPackId | null): number {
  if (packId === 'p50') return 1
  if (packId === 'p100') return 2
  if (packId === 'unlimited') return 3
  return 0
}

/** Trần khách. `null` = không giới hạn. */
export function weddingGuestCap(packId: WeddingGuestPackId | null): number | null {
  if (!packId) return WEDDING_GUEST_FREE_CAP
  return weddingGuestPackById(packId).cap
}

export function weddingGuestPackListPriceVnd(packId: WeddingGuestPackId): number {
  return weddingGuestPackById(packId).priceVnd
}

/** Số tiền phải chuyển khi nâng từ gói đang có. Gói thấp hơn hoặc đang dùng = 0. */
export function weddingGuestPackUpgradeVnd(
  from: WeddingGuestPackId | null,
  to: WeddingGuestPackId,
): number {
  if (weddingGuestPackRank(to) <= weddingGuestPackRank(from)) return 0
  const paid = from ? weddingGuestPackListPriceVnd(from) : 0
  return weddingGuestPackListPriceVnd(to) - paid
}

export function canAddWeddingGuests(
  guestCount: number,
  adding: number,
  packId: WeddingGuestPackId | null,
): boolean {
  if (adding <= 0) return true
  const cap = weddingGuestCap(packId)
  if (cap == null) return true
  return guestCount + adding <= cap
}

export function weddingGuestPackOffers(
  current: WeddingGuestPackId | null,
  guestCount: number,
): WeddingGuestPackOffer[] {
  return WEDDING_GUEST_PACKS.map((pack) => {
    const upgrade = weddingGuestPackRank(pack.id) > weddingGuestPackRank(current)
    const fits = pack.cap == null || pack.cap >= guestCount
    const payVnd = upgrade ? weddingGuestPackUpgradeVnd(current, pack.id) : 0
    return {
      id: pack.id,
      label: pack.label,
      guestCap: pack.cap,
      listPriceVnd: pack.priceVnd,
      payVnd,
      available: upgrade && fits && payVnd > 0,
      current: pack.id === current,
    }
  })
}

export function buildWeddingGuestPackQuota(
  packId: WeddingGuestPackId | null,
  guestCount: number,
): WeddingGuestPackQuota {
  const guestCap = weddingGuestCap(packId)
  const count = Math.max(0, Math.floor(guestCount))
  return {
    packId,
    guestCount: count,
    guestCap,
    remaining: guestCap == null ? null : Math.max(0, guestCap - count),
    offers: weddingGuestPackOffers(packId, count),
  }
}

export type WeddingGuestSideQuotas = {
  groom: WeddingGuestPackQuota
  bride: WeddingGuestPackQuota
}

export function weddingGuestPackSideLabel(side: WeddingGuestPackSide): string {
  return side === 'bride' ? 'nhà gái' : 'nhà trai'
}

export function weddingGuestPackLimitSide(code: string): WeddingGuestPackSide | null {
  if (code === 'guest_pack_limit_bride') return 'bride'
  if (code === 'guest_pack_limit_groom') return 'groom'
  return null
}

export function buildWeddingGuestSideQuotas(input: {
  groomPack: WeddingGuestPackId | null
  bridePack: WeddingGuestPackId | null
  groomCount: number
  brideCount: number
}): WeddingGuestSideQuotas {
  return {
    groom: buildWeddingGuestPackQuota(input.groomPack, input.groomCount),
    bride: buildWeddingGuestPackQuota(input.bridePack, input.brideCount),
  }
}

export function formatWeddingPackVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(amount)))}đ`
}

export function weddingGuestPackBlockedMessage(
  quota: WeddingGuestPackQuota,
  side?: WeddingGuestPackSide,
): string {
  const label = side ? weddingGuestPackSideLabel(side) : ''
  const titled = label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : ''
  if (!quota.packId) {
    if (titled) {
      return `${titled} đã dùng 3 khách dùng thử. Chọn gói ${label} để thêm từ khách thứ 4.`
    }
    return 'Đã dùng 3 khách dùng thử. Chọn gói để thêm từ khách thứ 4.'
  }
  if (quota.guestCap == null) return 'Không thêm được khách.'
  if (label) return `Gói ${label} tối đa ${quota.guestCap} khách. Nâng gói ${label} để thêm tiếp.`
  return `Gói này tối đa ${quota.guestCap} khách. Nâng gói để thêm tiếp.`
}

export function weddingGuestPackBanner(quota: WeddingGuestPackQuota, side?: WeddingGuestPackSide): string {
  const label = side ? ` ${weddingGuestPackSideLabel(side)}` : ''
  if (quota.guestCap == null) {
    return `Gói${label} không giới hạn · ${quota.guestCount} khách`
  }
  if (!quota.packId && quota.guestCount > WEDDING_GUEST_FREE_CAP) {
    return `Đã thêm ${quota.guestCount} khách${label}. Bản dùng thử là 3 khách. Chọn gói để thêm tiếp.`
  }
  if (!quota.packId) {
    return `Còn ${quota.remaining ?? 0} khách dùng thử${label} · đã thêm ${quota.guestCount}`
  }
  if ((quota.remaining ?? 0) === 0) {
    return `Gói${label} tối đa ${quota.guestCap} khách · đã đủ ${quota.guestCount}. Nâng gói để thêm tiếp.`
  }
  return `Gói${label} tối đa ${quota.guestCap} khách · đã thêm ${quota.guestCount}`
}
