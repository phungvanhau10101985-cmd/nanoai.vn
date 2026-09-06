import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { partnerPwaManifestColor } from './partner-site-pwa'

function fallbackIconRel(size: number): string {
  if (size === 180) return path.join('icons', 'apple-touch-icon.png')
  if (size === 512) return path.join('icons', 'icon-512x512.png')
  return path.join('icons', 'icon-192x192.png')
}

async function readFallbackIcon(size: number): Promise<Buffer> {
  return fs.readFile(path.join(process.cwd(), 'public', fallbackIconRel(size)))
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  if (!isHttpUrl(logoUrl)) return null
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

async function resizeExactPng(input: Buffer, size: number): Promise<Buffer> {
  const fit = size <= 48 ? 'contain' : 'cover'
  return sharp(input)
    .resize(size, size, {
      fit,
      position: 'centre',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

async function resizeMaskablePng(input: Buffer, size: number, backgroundColor: string): Promise<Buffer> {
  const bg = partnerPwaManifestColor(backgroundColor, '#ffffff')
  const inner = Math.max(1, Math.round(size * 0.8))
  const logo = await sharp(input)
    .resize(inner, inner, { fit: 'contain', background: bg })
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** Square PNG at the exact PWA size Chrome requires (192 / 512) or apple-touch (180). */
export async function buildPartnerPwaIconPng(opts: {
  logoUrl: string | null
  size: number
  backgroundColor: string
  maskable: boolean
}): Promise<Buffer> {
  const size = opts.size
  const logoBuf = opts.logoUrl?.trim() ? await fetchLogoBuffer(opts.logoUrl.trim()) : null
  const source = logoBuf ?? (await readFallbackIcon(size))
  try {
    if (opts.maskable) return await resizeMaskablePng(source, size, opts.backgroundColor)
    if (logoBuf) return await resizeExactPng(logoBuf, size)
    return await resizeExactPng(source, size)
  } catch {
    return readFallbackIcon(size)
  }
}
