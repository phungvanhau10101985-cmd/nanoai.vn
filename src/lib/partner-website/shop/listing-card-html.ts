import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'

/** 188 SimpleProductCard heart — listing / related / outfit / seed placeholders. */
export const PW_LISTING_HEART_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'

export function listingCardFavHtml(inventoryId: string, label: string): string {
  const id = String(inventoryId || '').trim()
  const idAttr = id ? ` data-inventory-id="${escapeAttr(id)}"` : ''
  return `<button type="button" class="pw-rec-fav" data-pw-favorite${idAttr} aria-pressed="false" aria-label="${escapeAttr(label)}">${PW_LISTING_HEART_SVG}</button>`
}

export function listingCardStatsHtml(input: {
  rating?: number | null
  sold?: number | null
  soldLabel: string
}): string {
  const rating = Number(input.rating)
  const score = Number.isFinite(rating) && rating > 0 ? rating : 0
  const sold = Math.max(0, Math.round(Number(input.sold) || 0))
  return `<div class="pw-rec-stats"><span>★ ${score.toFixed(1)}</span><span>${escapeHtml(input.soldLabel)}: ${sold}</span></div>`
}
