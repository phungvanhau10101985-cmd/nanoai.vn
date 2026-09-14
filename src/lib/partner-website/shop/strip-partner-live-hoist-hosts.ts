/** Hoisted live chrome sits outside React. Soft-nav from visual HTML leaves a second head. */

export const PARTNER_LIVE_HOIST_HOST_SEL =
  '[data-pw-live-chrome],[data-pw-live-dock],[data-pw-live-fixed-layer]'

const SHOP_HEADER_SEL =
  'header.pw-header,header.pw-shop-header,.pw-header[data-pw-region="header"],.pw-shop-header[data-pw-region="header"]'

const HEADER_MAIN_SEL =
  ':scope > .pw-header-main, :scope > .pw-shop-header-inner, :scope > .pw-container.pw-header-main'

export function stripPartnerLiveHoistHosts(scope?: ParentNode | null): void {
  const root = scope || (typeof document !== 'undefined' ? document : null)
  if (!root || typeof root.querySelectorAll !== 'function') return
  root.querySelectorAll(PARTNER_LIVE_HOIST_HOST_SEL).forEach((el) => {
    try {
      el.remove()
    } catch {
      /* ignore */
    }
  })
}

/** Header hoist only — do not drop React float/dock layers on resize. */
export function stripPartnerLiveChromeHosts(scope?: ParentNode | null): void {
  const root = scope || (typeof document !== 'undefined' ? document : null)
  if (!root || typeof root.querySelectorAll !== 'function') return
  root.querySelectorAll('[data-pw-live-chrome]').forEach((el) => {
    try {
      el.remove()
    } catch {
      /* ignore */
    }
  })
}

/**
 * Soft-nav leftover + hoist can leave two shop heads. Keep the React `.pw-shop` header
 * and drop extra `.pw-header-main` rows cloned into the same header.
 */
export function dedupePartnerShopLiveHeaders(scope?: ParentNode | null): void {
  const root = scope || (typeof document !== 'undefined' ? document : null)
  if (!root || typeof root.querySelectorAll !== 'function') return
  const headers = Array.from(root.querySelectorAll(SHOP_HEADER_SEL)) as HTMLElement[]
  if (headers.length > 1) {
    const keep =
      headers.find((h) => Boolean(h.closest?.('.pw-shop')) && !h.closest?.('[data-pw-live-chrome]')) ||
      headers[0]
    for (const header of headers) {
      if (header === keep) continue
      try {
        header.remove()
      } catch {
        /* ignore */
      }
    }
  }
  Array.from(root.querySelectorAll(SHOP_HEADER_SEL)).forEach((header) => {
    const mains = Array.from(header.querySelectorAll(HEADER_MAIN_SEL))
    for (let i = 1; i < mains.length; i += 1) {
      try {
        mains[i].remove()
      } catch {
        /* ignore */
      }
    }
  })
}
