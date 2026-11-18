/** Một việc nặng trong process cron. Cào listing giữ máy đến hết hàng đợi. Dưới 85% CPU và RAM cả máy thì các việc này chạy thay nhau. */

import { shopHostBlocksBackground } from '@/lib/cron/shop-host-pressure'

export type ShopHeavyKind = 'listing' | 'image-loc' | 'outfit' | 'ladipage' | 'source-stock'

let seq = 0
let hold: { kind: ShopHeavyKind; token: number } | null = null
const waiting = new Set<ShopHeavyKind>()

export function shopHeavyHolder(): ShopHeavyKind | null {
  return hold?.kind ?? null
}

export function shopHeavyBusy(): boolean {
  return hold !== null
}

export function shopHeavyWaiting(kind: ShopHeavyKind): boolean {
  return waiting.has(kind)
}

export function noteShopHeavyWaiting(kind: ShopHeavyKind, on: boolean): void {
  if (on) waiting.add(kind)
  else waiting.delete(kind)
}

/** Token khác 0 khi lấy được máy. Việc khác không chen khi cào listing đang chờ. Máy từ 85% CPU hoặc RAM thì chưa lấy. */
export function tryBeginShopHeavy(kind: ShopHeavyKind): number {
  if (hold) return 0
  if (kind !== 'listing' && waiting.has('listing')) return 0
  if (shopHostBlocksBackground()) return 0
  seq += 1
  hold = { kind, token: seq }
  waiting.delete(kind)
  return seq
}

export function endShopHeavy(token: number): void {
  if (hold && hold.token === token) hold = null
}
