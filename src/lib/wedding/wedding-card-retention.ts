/** Thiệp còn đến hết ngày lễ, rồi thêm đúng số ngày này. Sáng ngày thứ 18 sau lễ thì gỡ. */
export const WEDDING_CARD_RETENTION_DAYS = 18

export const WEDDING_CARD_RETENTION_NOTICE =
  'Thiệp và danh sách khách tự xóa 18 ngày sau ngày lễ. Ảnh nền và nhạc dùng chung vẫn giữ trong kho.'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function latestWeddingCeremonyIso(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((value): value is string => Boolean(value && ISO_DATE.test(value)))
  if (valid.length === 0) return null
  return valid.reduce((latest, value) => (value > latest ? value : latest))
}

export function addIsoDays(iso: string, days: number): string | null {
  const match = ISO_DATE.exec(iso)
  if (!match || !Number.isInteger(days)) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + days)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Ngày đầu tiên thiệp không còn: ngày lễ + 18. */
export function weddingCardRemovalIso(ceremonyIso: string | null): string | null {
  if (!ceremonyIso) return null
  return addIsoDays(ceremonyIso, WEDDING_CARD_RETENTION_DAYS)
}

export function isWeddingCardExpired(ceremonyIso: string | null, todayIso: string): boolean {
  const removalIso = weddingCardRemovalIso(ceremonyIso)
  if (!removalIso || !ISO_DATE.test(todayIso)) return false
  return todayIso >= removalIso
}

export function todayIsoInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function formatWeddingIsoVi(iso: string | null): string {
  const match = iso ? ISO_DATE.exec(iso) : null
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function weddingCoupleLabel(groomName: string, brideName: string): string {
  const label = [groomName.trim(), brideName.trim()].filter(Boolean).join(' & ')
  return label || 'của bạn'
}

export function weddingGuestPackPurchaseBody(input: {
  groomName: string
  brideName: string
  ceremonyIso: string | null
}): string {
  const label = weddingCoupleLabel(input.groomName, input.brideName)
  const ceremony = formatWeddingIsoVi(input.ceremonyIso)
  const removal = formatWeddingIsoVi(weddingCardRemovalIso(input.ceremonyIso))
  if (ceremony && removal) {
    return `Thiệp ${label} tự xóa vào ${removal} (18 ngày sau ngày lễ ${ceremony}). Danh sách khách và link thiệp xóa cùng lúc. Ảnh nền và nhạc dùng chung vẫn giữ trong kho.`
  }
  return `Thiệp ${label} tự xóa 18 ngày sau ngày lễ đã ghi trên thiệp. Danh sách khách và link thiệp xóa cùng lúc. Ảnh nền và nhạc dùng chung vẫn giữ trong kho.`
}

export function weddingCardExpiredBody(input: {
  groomName: string
  brideName: string
  ceremonyIso: string | null
}): string {
  const label = weddingCoupleLabel(input.groomName, input.brideName)
  const ceremony = formatWeddingIsoVi(input.ceremonyIso)
  const when = ceremony ? ` vì đã qua 18 ngày sau ngày lễ ${ceremony}` : ' vì đã qua 18 ngày sau ngày lễ'
  return `Thiệp ${label} đã được xóa${when}. Ảnh nền và nhạc dùng chung vẫn giữ trong kho.`
}
