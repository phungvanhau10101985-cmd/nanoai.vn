import { NextRequest, NextResponse } from 'next/server'

/**
 * Tìm ảnh thật trên Pexels theo từ khóa.
 * GET /api/slide-search-image?query=math+education
 * Trả về URL ảnh trực tiếp từ Pexels CDN.
 */
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('query')?.trim()
    if (!query) {
      return NextResponse.json({ error: 'Thiếu tham số query.' }, { status: 400 })
    }

    const apiKey = process.env.PEXELS_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu PEXELS_API_KEY. Đăng ký miễn phí tại pexels.com/api' }, { status: 500 })
    }

    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
      }
    )

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      return NextResponse.json({ error: `Pexels API lỗi ${res.status}: ${err.slice(0, 100)}` }, { status: 502 })
    }

    const data = (await res.json()) as {
      photos?: Array<{ src?: { medium?: string; large?: string; large2x?: string }; url?: string }>
    }

    const photo = data?.photos?.[0]
    const url = photo?.src?.large ?? photo?.src?.medium ?? photo?.src?.large2x
    if (!url) {
      return NextResponse.json({ error: 'Không tìm thấy ảnh phù hợp.' }, { status: 404 })
    }

    return NextResponse.json({ url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
