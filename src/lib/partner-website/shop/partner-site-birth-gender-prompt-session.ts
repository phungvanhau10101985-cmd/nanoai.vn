/** Gắn cờ sau đăng nhập shop để hiện popup nhắc ngày sinh / giới tính (UX 188). */

export function partnerSiteFreshLoginKey(siteSlug: string): string {
  return `pw_fresh_login_after_auth:${siteSlug.trim()}`
}

export function partnerSiteBirthGenderPromptDismissKey(siteSlug: string): string {
  return `pw_birth_gender_prompt_dismissed:${siteSlug.trim()}`
}

export function markPartnerSiteFreshLoginSession(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  const slug = siteSlug.trim()
  if (!slug) return
  try {
    sessionStorage.removeItem(partnerSiteBirthGenderPromptDismissKey(slug))
    sessionStorage.setItem(partnerSiteFreshLoginKey(slug), '1')
  } catch {
    /* quota / private mode */
  }
}

export function clearPartnerSiteFreshLoginSession(siteSlug: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(partnerSiteFreshLoginKey(siteSlug.trim()))
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
