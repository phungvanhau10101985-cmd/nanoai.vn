import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { ocrSlideImagesInBatches } from '@/app/tao-giao-trinh/lib/slide-image-ocr-batch'
import type { SlideInkLine } from '@/app/tao-giao-trinh/lib/slide-infographic'

const cache = new Map<string, { width: number; height: number; lines: SlideInkLine[] }>()

function allowedSlideImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const host = url.hostname
    return host === 'cdn.nanoai.vn' || host.endsWith('.b-cdn.net') || host.endsWith('.nanoai.vn')
  } catch {
    return false
  }
}

/** Ghép ảnh slide, đọc chữ một lần, trả khung về từng ảnh. Lần sau dùng bộ nhớ của tiến trình. */
export async function POST(req: NextRequest) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 })
  const body = await req.json().catch(() => null)
  const incoming = Array.isArray(body?.images) ? body.images.slice(0, 10) : []
  const wanted: Array<{ id: string; url: string }> = []
  for (const item of incoming) {
    const id = String(item?.id ?? '').slice(0, 40)
    const url = String(item?.url ?? '').trim()
    if (!id || !allowedSlideImageUrl(url)) continue
    wanted.push({ id, url })
  }
  if (!wanted.length) return NextResponse.json({ ok: false, error: 'Không có ảnh slide.' }, { status: 400 })
  const missing: Array<{ id: string; url: string }> = []
  const images: Array<{ id: string; url: string; width: number; height: number; lines: SlideInkLine[] }> = []
  for (const item of wanted) {
    const hit = cache.get(item.url)
    if (hit) images.push({ id: item.id, url: item.url, ...hit })
    else missing.push(item)
  }
  if (missing.length) {
    const buffers = await Promise.all(missing.map(async (item) => {
      const res = await fetch(item.url)
      if (!res.ok) throw new Error(`Không tải được ảnh slide (${res.status})`)
      return { id: item.id, bytes: Buffer.from(await res.arrayBuffer()) }
    }))
    const read = await ocrSlideImagesInBatches(buffers, auth.user.id)
    for (const row of read) {
      const source = missing.find((item) => item.id === row.id)
      if (!source) continue
      const packed = {
        width: row.width,
        height: row.height,
        lines: row.lines.slice(0, 120).map((line) => ({
          text: line.text.slice(0, 240),
          x: line.x,
          y: line.y,
          w: line.w,
          h: line.h,
        })),
      }
      cache.set(source.url, packed)
      images.push({ id: row.id, url: source.url, ...packed })
    }
  }
  return NextResponse.json({ ok: true, images })
}
