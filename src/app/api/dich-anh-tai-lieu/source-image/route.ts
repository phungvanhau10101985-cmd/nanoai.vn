import { NextRequest, NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import { acceptedImageMime, isEditableTranslateImageUrl } from '@/lib/dich-anh-tai-lieu/edit-image-source'

export const maxDuration = 30

const MAX_BYTES = 40 * 1024 * 1024

/** Kéo ảnh CDN về cùng origin để canvas đọc pixel. Không xử lý ảnh. */
export async function GET(req: NextRequest) {
  const user = await getUserOrBypass()
  if (!user) return new NextResponse(null, { status: 401 })

  const raw = req.nextUrl.searchParams.get('url')?.trim() || ''
  const requestHost = req.nextUrl.hostname
  const allowLocal = requestHost === 'localhost' || requestHost === '127.0.0.1'
  if (!isEditableTranslateImageUrl(raw, process.env.BUNNY_STORAGE_PUBLIC_BASE_URL, { allowLocal })) {
    return new NextResponse(null, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(raw, { redirect: 'manual', signal: AbortSignal.timeout(25000) })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
  if (upstream.status >= 300 && upstream.status < 400) return new NextResponse(null, { status: 502 })
  if (!upstream.ok) return new NextResponse(null, { status: 502 })

  const buf = Buffer.from(await upstream.arrayBuffer())
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return new NextResponse(null, { status: 413 })
  const mime = acceptedImageMime(upstream.headers.get('content-type'), buf)
  if (!mime) return new NextResponse(null, { status: 415 })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
