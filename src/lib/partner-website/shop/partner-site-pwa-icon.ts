import sharp from 'sharp'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { partnerPwaManifestColor } from './partner-site-pwa'

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
  logoUrl?: string | null
}): string[] {
  const out: string[] = []
  for (const raw of [input.faviconUrl, input.logoUrl]) {
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

function hexToFlattenBg(hex: string): { r: number; g: number; b: number; alpha: number } {
  const n = partnerPwaManifestColor(hex, '#111827').replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => `${c}${c}`).join('') : n
  return {
    r: parseInt(full.slice(0, 2), 16) || 17,
    g: parseInt(full.slice(2, 4), 16) || 24,
    b: parseInt(full.slice(4, 6), 16) || 39,
    alpha: 1,
  }
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

async function letterTilePng(size: number, letter: string, backgroundColor: string): Promise<Buffer> {
  const bg = partnerPwaManifestColor(backgroundColor, '#111827')
  const glyph = partnerShopIconFallbackLetter(letter)
  const fontSize = Math.round(size * 0.52)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${glyph}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function resizeExactPng(input: Buffer, size: number, backgroundColor: string): Promise<Buffer> {
  const pad = hexToFlattenBg(backgroundColor)
  const meta = await sharp(input).metadata()
  const fit = meta.hasAlpha ? 'contain' : 'cover'
  return sharp(input)
    .resize(size, size, {
      fit,
      position: 'centre',
      background: pad,
    })
    .flatten({ background: pad })
    .png()
    .toBuffer()
}

async function resizeMaskablePng(input: Buffer, size: number, backgroundColor: string): Promise<Buffer> {
  const bg = partnerPwaManifestColor(backgroundColor, '#111827')
  const pad = hexToFlattenBg(bg)
  const inner = Math.max(1, Math.round(size * 0.8))
  const logo = await sharp(input)
    .resize(inner, inner, { fit: 'contain', background: pad })
    .flatten({ background: pad })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: pad,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Square PNG at the exact PWA size Chrome requires (192 / 512) or apple-touch (180). Never NanoAI platform icons. */
export async function buildPartnerPwaIconPng(opts: {
  logoUrl?: string | null
  logoUrls?: string[]
  size: number
  backgroundColor: string
  maskable: boolean
  fallbackLetter?: string
}): Promise<Buffer> {
  const size = opts.size
  const urls = [
    ...(opts.logoUrls || []),
    ...(opts.logoUrl?.trim() ? [opts.logoUrl.trim()] : []),
  ].filter((url, index, all) => all.indexOf(url) === index)
  const logoBuf = await fetchFirstLogoBuffer(urls)
  const pad = shopBrowserChromeColor(opts.backgroundColor)
  try {
    if (logoBuf) {
      if (opts.maskable) return await resizeMaskablePng(logoBuf, size, pad)
      return await resizeExactPng(logoBuf, size, pad)
    }
  } catch {
    /* shop letter tile — never public/icons NanoAI */
  }
  return letterTilePng(size, opts.fallbackLetter || 'S', pad)
}
