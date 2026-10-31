import { parseWeddingOrnamentList } from '@/lib/wedding/wedding-background-ornament-store'
import type { WeddingBackgroundOrnament } from '@/lib/wedding/wedding-background-presets'

const CHANNEL = 'wedding-ornament-shown'

export type WeddingOrnamentTruth = {
  source: string
  cardId: string
  /** true: mẫu chung. false: bản riêng của đúng thiệp. */
  template: boolean
  /** null là xóa khóa. Mảng rỗng là còn khóa nhưng không còn hoa. */
  ornaments: WeddingBackgroundOrnament[] | null
}

/** Báo các trang đang mở của cùng thiệp để vỏ, preview và xem nhanh hiện một danh sách. */
export function publishWeddingOrnamentTruth(message: WeddingOrnamentTruth) {
  if (typeof BroadcastChannel === 'undefined' || !message.cardId) return
  const channel = new BroadcastChannel(CHANNEL)
  channel.postMessage(message)
  channel.close()
}

export function subscribeWeddingOrnamentTruth(
  cardId: string,
  source: string,
  onTruth: (message: WeddingOrnamentTruth) => void,
) {
  if (typeof BroadcastChannel === 'undefined' || !cardId) return () => {}
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent<WeddingOrnamentTruth>) => {
    const data = event.data
    if (!data || data.cardId !== cardId || data.source === source) return
    if (data.template !== true && data.template !== false) return
    if (data.ornaments == null) {
      onTruth({ source: data.source, cardId, template: data.template, ornaments: null })
      return
    }
    const ornaments = parseWeddingOrnamentList(data.ornaments)
    if (!ornaments) return
    onTruth({ source: data.source, cardId, template: data.template, ornaments })
  }
  return () => channel.close()
}
