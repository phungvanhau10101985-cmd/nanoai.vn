import { NextRequest, NextResponse } from 'next/server'
import { fetchImageWith1688Bypass, sniffImageContentType } from '@/lib/fetch-image-1688'

const STOREFRONT_IMAGE_MAX_BYTES = 12 * 1024 * 1024
const STOREFRONT_IMAGE_TIMEOUT_MS = 20_000

/**
 * API proxy tải ảnh từ URL (vượt chặn 1688/alibaba).
 * Client gọi thay vì fetch trực tiếp để tránh CORS.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL không hợp lệ' }, { status: 400 })
  }

  try {
    const buf = await fetchImageWith1688Bypass(url, {
      maxBytes: STOREFRONT_IMAGE_MAX_BYTES,
      timeoutMs: STOREFRONT_IMAGE_TIMEOUT_MS,
    })
    const ext = url.match(/\.(jpe?g|png|gif|webp)/i)?.[1]?.toLowerCase() || 'png'
    const contentType =
      sniffImageContentType(buf) ||
      (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
