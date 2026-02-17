import { NextRequest, NextResponse } from 'next/server'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'

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
    const buf = await fetchImageWith1688Bypass(url)
    const ext = url.match(/\.(jpe?g|png|gif|webp)/i)?.[1]?.toLowerCase() || 'png'
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
