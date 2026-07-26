export type BannerOnImageCopy = {
  headline: string
  subhead: string
  cta: string
  domain: string
}

const FIELD_RE = /^(HEADLINE|SUBHEAD|CTA|DOMAIN)\s*:\s*(.*)$/i

/** Strip decorative quotes Gemini sometimes wraps around copy values. */
export function stripBannerCopyQuotes(value: string): string {
  let v = value.trim()
  for (let i = 0; i < 3; i++) {
    const pairs: [string, string][] = [
      ['"', '"'],
      ["'", "'"],
      ['\u201C', '\u201D'],
      ['\u2018', '\u2019'],
      ['\u300C', '\u300D'],
      ['\u300E', '\u300F'],
    ]
    let changed = false
    for (const [open, close] of pairs) {
      if (v.startsWith(open) && v.endsWith(close) && v.length > open.length + close.length) {
        v = v.slice(open.length, -close.length).trim()
        changed = true
      }
    }
    if (!changed) break
  }
  return v
}

/** Parse structured copywriter output — strips HEADLINE:/SUBHEAD:/… labels. */
export function parseBannerOnImageCopy(raw: string): BannerOnImageCopy {
  const result: BannerOnImageCopy = { headline: '', subhead: '', cta: '', domain: '' }
  const trimmed = raw.trim()
  if (!trimmed) return result

  let matchedStructured = false
  for (const line of trimmed.split('\n')) {
    const row = line.trim()
    if (!row) continue
    const m = row.match(FIELD_RE)
    if (!m) continue
    matchedStructured = true
    const key = m[1].toLowerCase()
    const value = stripBannerCopyQuotes(m[2])
    if (key === 'headline') result.headline = value
    else if (key === 'subhead') result.subhead = value
    else if (key === 'cta') result.cta = value
    else if (key === 'domain') result.domain = value
  }

  if (!matchedStructured) {
    result.headline = stripBannerCopyQuotes(trimmed)
  }
  return result
}

/** Copy block for image-generation prompts — never includes field labels. */
export function formatBannerOnImageCopyForGeneration(
  copy: BannerOnImageCopy,
  opts?: { omitDomain?: boolean }
): string {
  const lines: string[] = []
  if (copy.headline) lines.push(`Headline (large, bold): ${copy.headline}`)
  if (copy.subhead) lines.push(`Subhead (smaller): ${copy.subhead}`)
  if (copy.cta) lines.push(`CTA button text: ${copy.cta}`)
  if (copy.domain && !opts?.omitDomain) {
    lines.push(`Optional small URL text: ${copy.domain}`)
  }
  if (opts?.omitDomain) {
    lines.push(
      'Brand logo image is attached separately — show the logo graphic; do NOT typeset the domain as a text substitute for the logo.'
    )
  }
  lines.push(
    'CRITICAL: Print only the plain text values above — no quotation marks around headline or CTA; never print field labels (HEADLINE, SUBHEAD, CTA, DOMAIN).'
  )
  return lines.join('\n')
}

/** Flat overlay instruction for generateAsset fallback. */
export function formatBannerOnImageCopyFlat(
  copy: BannerOnImageCopy,
  opts?: { omitDomain?: boolean }
): string {
  const parts = [copy.headline, copy.subhead, copy.cta]
    .map((s) => s.trim())
    .filter(Boolean)
  if (copy.domain && !opts?.omitDomain) parts.push(copy.domain)
  return parts.join(' · ')
}
