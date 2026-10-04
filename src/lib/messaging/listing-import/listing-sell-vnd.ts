import { listingVndPerCny } from '@/lib/messaging/listing-import/scrape-common'
import {
  cnyExchangeMultiplierFromGrid,
  estimateListingVndRounded,
} from '@/lib/messaging/listing-import/taobao-cards-html-parse'

/** Giá bán = CNY × hệ số lưới × LISTING_IMPORT_VND_PER_CNY, làm tròn lên 10.000đ. */
export function listingSellVndForCny(priceCny: number): number {
  if (!Number.isFinite(priceCny) || priceCny <= 0) return 0
  const coef = cnyExchangeMultiplierFromGrid(priceCny)
  const vnd = estimateListingVndRounded(
    { price_cny_approx: priceCny, cny_exchange_multiplier: coef },
    listingVndPerCny()
  )
  return vnd != null && vnd > 0 ? vnd : 0
}
