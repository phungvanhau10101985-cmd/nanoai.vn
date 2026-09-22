/** Một token conversion Google Ads — chỉ AW-/label; merchant có thể dán kèm send_to/snippet. */
const AW_CONVERSION_LABEL_RE = /\bAW-\d+\/[A-Za-z0-9_-]+/i

export function normalizeGoogleAdsConversionLabel(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  let m = trimmed.match(AW_CONVERSION_LABEL_RE)
  if (!m) {
    const compact = trimmed.replace(/\s/g, '')
    m = compact.match(/AW-\d+\/[A-Za-z0-9_-]+/i)
  }
  if (!m) return null
  const t = m[0].replace(/\s/g, '')
  if (!/^AW-\d+\/[A-Za-z0-9_-]+$/i.test(t)) return null
  const slash = t.indexOf('/')
  return `${t.slice(0, slash).toUpperCase()}/${t.slice(slash + 1)}`
}

export function normalizeGoogleSearchConsoleVerify(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (!v || v.length > 200) return null
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return null
  return v
}

export function normalizeGoogleMerchantCenterVerify(raw: string | null | undefined): string | null {
  return normalizeGoogleSearchConsoleVerify(raw)
}

export function normalizeFacebookDomainVerification(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim()
  if (!v || v.length > 200) return null
  if (!/^[A-Za-z0-9_-]+$/.test(v)) return null
  return v
}
