const PAGE_LOAD_KEY = 'pw_purchase_after_page_'
const TRACKED_KEY = 'pw_purchase_tracked_order_'

/** Giỏ không cọc: đánh dấu để trang đơn bắn Purchase sau khi đã tải. */
export function markPartnerPurchaseAfterPageLoad(orderId: string): void {
  const id = orderId.trim()
  if (!id || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${PAGE_LOAD_KEY}${id}`, '1')
  } catch {
    /* private */
  }
}

export function hasPartnerPurchaseAfterPageLoad(orderId: string): boolean {
  const id = orderId.trim()
  if (!id || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(`${PAGE_LOAD_KEY}${id}`) === '1'
  } catch {
    return false
  }
}

export function clearPartnerPurchaseAfterPageLoad(orderId: string): void {
  const id = orderId.trim()
  if (!id || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(`${PAGE_LOAD_KEY}${id}`)
  } catch {
    /* private */
  }
}

/** Một trình duyệt chỉ bắn Purchase một lần cho một đơn. */
export function claimPartnerPurchaseTracked(orderId: string): boolean {
  const id = orderId.trim()
  if (!id || typeof localStorage === 'undefined') return false
  const key = `${TRACKED_KEY}${id}`
  try {
    if (localStorage.getItem(key) === '1') return false
    localStorage.setItem(key, '1')
    return true
  } catch {
    return true
  }
}
