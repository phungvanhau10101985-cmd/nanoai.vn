/** Gắn cờ sau đăng nhập shop để hiện popup nhắc ngày sinh / giới tính và cài web app. */

export const PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT = 'pw-birth-gender-prompt-settled'

export function partnerSiteFreshLoginKey(siteSlug: string): string {
  return `pw_fresh_login_after_auth:${siteSlug.trim()}`
}

export function partnerSitePwaInstallPromptPendingKey(siteSlug: string): string {
  return `pw_pwa_install_prompt_pending:${siteSlug.trim()}`
}

export function partnerSitePwaInstallPromptDismissKey(siteSlug: string): string {
  return `pw_pwa_install_prompt_dismissed:${siteSlug.trim()}`
}

export function partnerSitePwaInstalledStorageKey(siteSlug: string): string {
  return `pw_pwa_installed:${siteSlug.trim()}`
}

/** Đã hiện hộp cài trên máy này. Lần đăng nhập sau xóa cờ để nhắc lại. */
export function partnerSitePwaInstallPromptSeenKey(siteSlug: string): string {
  return `pw_pwa_install_prompt_seen:${siteSlug.trim()}`
}

export function partnerSiteBirthGenderPromptDismissKey(siteSlug: string): string {
  return `pw_birth_gender_prompt_dismissed:${siteSlug.trim()}`
}

export function notifyPartnerSiteBirthGenderPromptSettled(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT))
}

export function markPartnerSiteFreshLoginSession(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    sessionStorage.removeItem(partnerSiteBirthGenderPromptDismissKey(slug))
    sessionStorage.removeItem(partnerSitePwaInstallPromptDismissKey(slug))
    sessionStorage.setItem(partnerSiteFreshLoginKey(slug), '1')
    sessionStorage.setItem(partnerSitePwaInstallPromptPendingKey(slug), '1')
  } catch {
    /* quota / private mode */
  }
  try {
    localStorage.removeItem(partnerSitePwaInstallPromptSeenKey(slug))
  } catch {
    /* ignore */
  }
}

export function clearPartnerSiteFreshLoginSession(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(partnerSiteFreshLoginKey(siteSlug.trim()))
  } catch {
    /* ignore */
  }
  notifyPartnerSiteBirthGenderPromptSettled()
}

export function isPartnerSitePwaInstallPromptPending(siteSlug: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(partnerSitePwaInstallPromptPendingKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function isPartnerSitePwaInstallPromptDismissed(siteSlug: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(partnerSitePwaInstallPromptDismissKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function clearPartnerSitePwaInstallPromptPending(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(partnerSitePwaInstallPromptPendingKey(siteSlug.trim()))
  } catch {
    /* ignore */
  }
}

export function isPartnerSitePwaInstallPromptSeen(siteSlug: string): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(partnerSitePwaInstallPromptSeenKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function markPartnerSitePwaInstallPromptSeen(siteSlug: string): void {
  if (typeof localStorage === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    localStorage.setItem(partnerSitePwaInstallPromptSeenKey(slug), '1')
  } catch {
    /* ignore */
  }
}

export function dismissPartnerSitePwaInstallPrompt(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    sessionStorage.setItem(partnerSitePwaInstallPromptDismissKey(slug), '1')
  } catch {
    /* ignore */
  }
  markPartnerSitePwaInstallPromptSeen(slug)
  clearPartnerSitePwaInstallPromptPending(slug)
}

export function isPartnerSitePwaRememberedInstalled(siteSlug: string): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(partnerSitePwaInstalledStorageKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function markPartnerSitePwaInstalled(siteSlug: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(partnerSitePwaInstalledStorageKey(siteSlug.trim()), '1')
  } catch {
    /* ignore */
  }
  markPartnerSitePwaInstallPromptSeen(siteSlug)
  clearPartnerSitePwaInstallPromptPending(siteSlug)
}

export function clearPartnerSitePwaRememberedInstalled(siteSlug: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(partnerSitePwaInstalledStorageKey(siteSlug.trim()))
  } catch {
    /* ignore */
  }
}

export function isPartnerSiteFreshLoginSession(siteSlug: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(partnerSiteFreshLoginKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function dismissPartnerSiteBirthGenderPrompt(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    sessionStorage.setItem(partnerSiteBirthGenderPromptDismissKey(slug), '1')
  } catch {
    /* ignore */
  }
  clearPartnerSiteFreshLoginSession(slug)
}

export function isPartnerSiteBirthGenderPromptDismissed(siteSlug: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(partnerSiteBirthGenderPromptDismissKey(siteSlug.trim())) === '1'
  } catch {
    return false
  }
}

export function isPartnerSiteShopLoginPath(pathname: string): boolean {
  const p = String(pathname || '').split('?')[0]
  return /\/login\/?$/i.test(p) || /\/auth\//i.test(p)
}
