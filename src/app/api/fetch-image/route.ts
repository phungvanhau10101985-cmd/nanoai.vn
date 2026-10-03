import { NextRequest, NextResponse } from 'next/server'
import { fetchImageWith1688Bypass, sniffImageContentType } from '@/lib/fetch-image-1688'
import { clampShopImageRetryEdge } from '@/lib/partner-website/shop/inventory-shop-detail'

/** Display thumbs/page sizes are well under 1MB. Originals (5–20MB) must not pass unchanged. */
const STOREFRONT_IMAGE_MAX_BYTES = 2.5 * 1024 * 1024
/** Retry `?w=` may download a Bunny original (banner AI ~2K PNG), then shrink before the phone decodes it. */
const DISPLAY_RETRY_INPUT_MAX_BYTES = 20 * 1024 * 1024
const STOREFRONT_IMAGE_TIMEOUT_MS = 20_000

function imageResponse(body: Buffer, contentType: string) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function shrinkForPhone(buf: Buffer, maxEdge: number): Promise<{ body: Buffer; contentType: string }> {
  const sniffed = sniffImageContentType(buf)
  const sharp = (await import('sharp')).default
  const meta = await sharp(buf, { limitInputPixels: 40_000_000, sequentialRead: true, failOn: 'none' }).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (
    sniffed &&
    width > 0 &&
    height > 0 &&
    width <= maxEdge &&
    height <= maxEdge &&
    buf.length <= STOREFRONT_IMAGE_MAX_BYTES
  ) {
    return { body: buf, contentType: sniffed }
  }
  let quality = 80
  let out = await sharp(buf, { limitInputPixels: 40_000_000, sequentialRead: true, failOn: 'none' })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer()
  if (out.length > STOREFRONT_IMAGE_MAX_BYTES) {
    quality = 60
    out = await sharp(buf, { limitInputPixels: 40_000_000, sequentialRead: true, failOn: 'none' })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer()
  }
  if (out.length > STOREFRONT_IMAGE_MAX_BYTES) {
    throw new Error('Ảnh sau thu nhỏ vẫn quá lớn')
  }
  return { body: out, contentType: 'image/jpeg' }
}

/**
 * API proxy tải ảnh từ URL (vượt chặn 1688/alibaba).
 * Client gọi thay vì fetch trực tiếp để tránh CORS.
 * `w` (64–1200) = thu nhỏ file Bunny/AliCDN quá lớn để điện thoại decode.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }
  const edge = clampShopImageRetryEdge(request.nextUrl.searchParams.get('w'))

  try {
    const buf = await fetchImageWith1688Bypass(url, {
      maxBytes: edge ? DISPLAY_RETRY_INPUT_MAX_BYTES : STOREFRONT_IMAGE_MAX_BYTES,
      timeoutMs: STOREFRONT_IMAGE_TIMEOUT_MS,
    })
    if (!edge) {
      const ext = url.match(/\.(jpe?g|png|gif|webp)/i)?.[1]?.toLowerCase() || 'png'
      const contentType =
        sniffImageContentType(buf) ||
        (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`)
      return imageResponse(buf, contentType)
    }
    const shrunk = await shrinkForPhone(buf, edge)
    return imageResponse(shrunk.body, shrunk.contentType)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
