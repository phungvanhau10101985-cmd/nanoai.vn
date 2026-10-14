import { NextResponse } from 'next/server'

import { getUserOrBypass } from '@/lib/auth'
import { PasteImageError } from '@/lib/chat/paste-image'
import { fetchPastedImage } from '@/lib/chat/fetch-pasted-image-server'

export const runtime = 'nodejs'

/** Tải link ảnh phía server khi trình duyệt bị CORS. Chỉ ảnh công khai, đã đăng nhập. */
export async function POST(request: Request) {
  const user = await getUserOrBypass()
  if (!user) return NextResponse.json({ error: 'failed' }, { status: 401 })

  let url = ''
  try {
    const body = (await request.json()) as { url?: unknown }
    url = typeof body.url === 'string' ? body.url.trim() : ''
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 400 })
  }
  if (!url) return NextResponse.json({ error: 'failed' }, { status: 400 })

  try {
    const image = await fetchPastedImage(url)
    return new NextResponse(new Blob([Buffer.from(image.bytes)], { type: image.mimeType }), {
      status: 200,
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'no-store',
        'X-Image-Name': encodeURIComponent(image.fileName),
      },
    })
  } catch (error) {
    const code = error instanceof PasteImageError ? error.code : 'failed'
    const status = code === 'not-image' || code === 'blocked' || code === 'too-large' ? 400 : 502
    return NextResponse.json({ error: code }, { status })
  }
}
