/** Đoạn văn dùng chung cả hai bên: không giữ địa chỉ tiệc. */

const SHARED_PROSE_FIELDS = [
  'coupleIntro',
  'loveQuote',
  'dressCode',
  'storyText',
  'thankYouText',
  'invitationText',
  'invitationTextEn',
] as const

type SharedProseField = (typeof SHARED_PROSE_FIELDS)[number]

export type WeddingSharedCopyAddressSource = {
  venue?: string | null
  groomHometown?: string | null
  brideHometown?: string | null
  groomInviteAddress?: string | null
  brideInviteAddress?: string | null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Địa chỉ nhà / đường. Bỏ tên ngắn kiểu «Nhà trai» để không cắt câu chuyện. */
export function looksLikeWeddingStreetAddress(value: string): boolean {
  const text = value.trim()
  if (text.length < 8) return false
  if (/\d/.test(text)) return true
  if (/(?:đường|phố|thôn|xóm|xã|phường|huyện|tỉnh|quận|ngõ|ngách|ấp|tổ|số)\b/i.test(text)) return true
  return text.length >= 12
}

export function weddingSharedCopyAddresses(source: WeddingSharedCopyAddressSource): string[] {
  const seen = new Set<string>()
  const addresses: string[] = []
  for (const value of [
    source.groomInviteAddress,
    source.brideInviteAddress,
    source.venue,
    source.groomHometown,
    source.brideHometown,
  ]) {
    const text = value?.trim() ?? ''
    const key = text.toLocaleLowerCase('vi')
    if (!looksLikeWeddingStreetAddress(text) || seen.has(key)) continue
    seen.add(key)
    addresses.push(text)
  }
  return addresses.sort((a, b) => b.length - a.length)
}

function tidySharedProse(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/(?:^|\n)[ \t]*(?:địa chỉ|địa điểm)\s*:\s*(?=\n|$)/gi, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/** Gỡ địa chỉ tiệc khỏi đoạn văn chung. Ngày cưới và câu chữ còn lại giữ nguyên. */
export function omitWeddingAddressesFromSharedCopy(
  text: string,
  addresses: Array<string | null | undefined>,
): string {
  const source = text ?? ''
  if (!source.trim()) return source
  const filtered = [...new Set(
    addresses
      .map((item) => item?.trim() ?? '')
      .filter((item) => looksLikeWeddingStreetAddress(item)),
  )].sort((a, b) => b.length - a.length)
  if (filtered.length === 0) return source

  let out = source
  let removed = false
  for (const address of filtered) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])(?:(?:tại|ở)\\s+)?${escapeRegExp(address)}(?![\\p{L}\\p{N}])`,
      'giu',
    )
    out = out.replace(pattern, () => {
      removed = true
      return ''
    })
  }
  if (!removed) return source
  return tidySharedProse(out)
}

export function stripSharedWeddingCopy<T extends WeddingSharedCopyAddressSource & Record<SharedProseField, string>>(
  card: T,
): T {
  const addresses = weddingSharedCopyAddresses(card)
  if (addresses.length === 0) return card
  let changed = false
  const next = { ...card }
  for (const field of SHARED_PROSE_FIELDS) {
    const stripped = omitWeddingAddressesFromSharedCopy(card[field] ?? '', addresses)
    if (stripped !== (card[field] ?? '')) {
      next[field] = stripped
      changed = true
    }
  }
  return changed ? next : card
}
