import sharp from 'sharp'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { partnerPwaManifestColor } from './partner-site-pwa'

/** Canvas for maskable / letter fallback — never `--pw-primary` (mark would vanish on the same hue). */
export const PARTNER_SHOP_ICON_CANVAS_HEX = '#ffffff'

const TRANSPARENT_PAD = { r: 255, g: 255, b: 255, alpha: 0 }
const WHITE_PAD = { r: 255, g: 255, b: 255, alpha: 1 }

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function partnerShopBrandIconUrls(input: {
  faviconUrl?: string | null
  pwaIconUrl?: string | null
  logoUrl?: string | null
}): string[] {
  const out: string[] = []
  for (const raw of [input.pwaIconUrl, input.faviconUrl, input.logoUrl]) {
    const value = String(raw || '').trim()
    if (!value || !isHttpUrl(value) || out.includes(value)) continue
    out.push(value)
  }
  return out
}

export function partnerShopIconFallbackLetter(name?: string | null): string {
  const letter = String(name || '')
    .trim()
    .replace(/^[^0-9a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\u4E00-\u9FFF]+/, '')
    .charAt(0)
  return (letter || 'S').toUpperCase()
}

function letterFillHex(hex: string): string {
  return partnerPwaManifestColor(hex, '#111827')
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(logoUrl, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32 || buf.length > 8 * 1024 * 1024) return null
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFirstLogoBuffer(urls: string[]): Promise<Buffer | null> {
  for (const url of urls) {
    const buf = await fetchLogoBuffer(url)
    if (buf) return buf
  }
  return null
}

async function letterTilePng(size: number, letter: string, letterColor: string): Promise<Buffer> {
  const fill = letterFillHex(letterColor)
  const glyph = partnerShopIconFallbackLetter(letter)
  const fontSize = Math.round(size * 0.52)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${PARTNER_SHOP_ICON_CANVAS_HEX}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="${fill}">${glyph}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function resizeExactPng(input: Buffer, size: number): Promise<Buffer> {
  const meta = await sharp(input).metadata()
  if (meta.hasAlpha) {
    return sharp(input)
      .ensureAlpha()
      .resize(size, size, {
        fit: 'contain',
        position: 'centre',
        background: TRANSPARENT_PAD,
      })
      .png()
      .toBuffer()
  }
  return sharp(input)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
}

async function resizeMaskablePng(input: Buffer, size: number): Promise<Buffer> {
  const inner = Math.max(1, Math.round(size * 0.8))
  const logo = await sharp(input)
    .ensureAlpha()
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT_PAD })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE_PAD,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Raster a shop icon buffer. Transparent PNG keeps alpha; maskable sits on white — never primary. */
export async function rasterPartnerShopIconPng(opts: {
  image: Buffer | null
  size: number
  maskable: boolean
  letterColor: string
  fallbackLetter?: string
}): Promise<Buffer> {
  const size = opts.size
  const letterColor = shopBrowserChromeColor(opts.letterColor)
  try {
    if (opts.image) {
      if (opts.maskable) return await resizeMaskablePng(opts.image, size)
      return await resizeExactPng(opts.image, size)
    }
  } catch {
    /* shop letter tile — never public/icons NanoAI */
  }
  return letterTilePng(size, opts.fallbackLetter || 'S', letterColor)
}

/** Square PNG. `backgroundColor` is the letter-fallback fill only — not the icon canvas. */
export async function buildPartnerPwaIconPng(opts: {
  logoUrl?: string | null
  logoUrls?: string[]
  size: number
  backgroundColor: string
  maskable: boolean
  fallbackLetter?: string
}): Promise<Buffer> {
  const urls = [
    ...(opts.logoUrls || []),
    ...(opts.logoUrl?.trim() ? [opts.logoUrl.trim()] : []),
  ].filter((url, index, all) => all.indexOf(url) === index)
  const logoBuf = await fetchFirstLogoBuffer(urls)
  return rasterPartnerShopIconPng({
    image: logoBuf,
    size: opts.size,
    maskable: opts.maskable,
    letterColor: opts.backgroundColor,
    fallbackLetter: opts.fallbackLetter,
  })
}
