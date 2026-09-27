/** Tên Storage/Pull Zone Bunny: chữ thường, số, gạch ngang. Không trùng zone nền tảng. */

const ZONE_MAX = 50

export function partnerBunnyZoneName(input: {
  slug: string
  attempt?: number
  partnerId?: string
  platformZoneName?: string | null
}): string {
  const attempt = Math.max(0, Math.floor(input.attempt ?? 0))
  let base = String(input.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base || !/^[a-z]/.test(base)) base = `shop-${base || 'cdn'}`.replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (base.length < 3) base = `${base}cdn`

  const platform = String(input.platformZoneName || '')
    .trim()
    .toLowerCase()
  if (platform && base === platform) base = `${base}-shop`

  const idTail = String(input.partnerId || '')
    .replace(/-/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 6)
  const suffix = attempt > 0 ? `-${idTail || 'x'}${attempt > 1 ? String(attempt) : ''}` : ''
  const room = Math.max(3, ZONE_MAX - suffix.length)
  let name = `${base.slice(0, room)}${suffix}`.replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!/^[a-z]/.test(name)) name = `shop-${name}`.replace(/-+/g, '-').slice(0, ZONE_MAX)
  return name
}
