export const PARTNER_SHOP_REOPEN_CHAT_KEY = 'pw_reopen_chat_v1'

function cartAddWindow(): Window | undefined {
  try {
    return (globalThis as { window?: Window }).window
  } catch {
    return undefined
  }
}

export function markPartnerShopReopenChat(): void {
  const win = cartAddWindow()
  if (!win) return
  try {
    win.sessionStorage.setItem(PARTNER_SHOP_REOPEN_CHAT_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumePartnerShopReopenChat(): boolean {
  const win = cartAddWindow()
  if (!win) return false
  try {
    const v = win.sessionStorage.getItem(PARTNER_SHOP_REOPEN_CHAT_KEY)
    if (v) win.sessionStorage.removeItem(PARTNER_SHOP_REOPEN_CHAT_KEY)
    return v === '1'
  } catch {
    return false
  }
}

/** Đóng modal giỏ từ chat (`from=nanoai`) — về trang trước và mở lại Chat mua. */
export function returnFromPartnerShopCartAdd(input: { fromNanoAi: boolean; fallbackHref: string }): void {
  const win = cartAddWindow()
  if (!win) return
  const fallback = input.fallbackHref.trim() || '/'
  if (input.fromNanoAi) {
    markPartnerShopReopenChat()
    if (win.history.length > 1) {
      win.history.back()
      win.setTimeout(() => {
        if (/\/cart\/add\//i.test(win.location.pathname)) {
          win.location.assign(fallback)
        }
      }, 400)
      return
    }
  }
  win.location.assign(fallback)
}
