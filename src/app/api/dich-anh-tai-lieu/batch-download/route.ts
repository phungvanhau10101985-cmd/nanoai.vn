import { NextRequest, NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import archiver from 'archiver'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchTryOnHistoryBatchDownloadRowsPg } from '@/lib/db/translate-process-pg'

/** Route Handler cho tải PDF/zip – timeout 120s (Server Action chỉ 15s trên Vercel) */
export const maxDuration = 120

type TryOnRow = { result_image_url?: string | null; batch_type?: string | null; original_image_url?: string | null }

function pageIndex(url: string | null | undefined): number | null {
  const match = /_page_(\d+)\./.exec(url || '')
  return match ? Number(match[1]) : null
}

function orderPages(rows: TryOnRow[]): TryOnRow[] {
  return rows
    .map((row, index) => ({ row, index, page: pageIndex(row.original_image_url) }))
    .sort((a, b) => {
      if (a.page == null && b.page == null) return a.index - b.index
      if (a.page == null) return 1
      if (b.page == null) return -1
      return a.page - b.page
    })
    .map((item) => item.row)
}

async function zipBuffers(entries: Array<{ name: string; buffer: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
    for (const entry of entries) archive.append(entry.buffer, { name: entry.name })
    archive.finalize()
  })
}

async function pagesToPdfUrl(userId: string, pages: Buffer[]): Promise<string> {
  const sharp = (await import('sharp')).default
  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  for (const pageBuffer of pages) {
    const png = await sharp(pageBuffer).png().toBuffer()
    const image = await pdfDoc.embedPng(png)
    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  const out = Buffer.from(await pdfDoc.save())
  const { publicUrl } = await uploadTryOnImagePublic(`results/${userId}/dich_tai_lieu_${Date.now()}.pdf`, out, {
    contentType: 'application/pdf',
    upsert: true,
  })
  return publicUrl
}

async function zipOriginalPages(userId: string, rows: TryOnRow[], pagePrefix: string): Promise<string | undefined> {
  const entries: Array<{ name: string; buffer: Buffer }> = []
  for (let i = 0; i < rows.length; i++) {
    const origUrl = rows[i].original_image_url
    if (!origUrl) continue
    try {
      const res = await fetch(origUrl, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) continue
      entries.push({ name: `${pagePrefix}_${i + 1}_goc.png`, buffer: Buffer.from(await res.arrayBuffer()) })
    } catch {
      /* bỏ trang gốc lỗi */
    }
  }
  if (entries.length === 0) return undefined
  const zip = await zipBuffers(entries)
  const { publicUrl } = await uploadTryOnImagePublic(`results/${userId}/dich_tai_lieu_goc_${Date.now()}.zip`, zip, {
    contentType: 'application/zip',
    upsert: true,
  })
  return publicUrl
}

export async function GET(request: NextRequest) {
  const batchId = request.nextUrl.searchParams.get('batchId')
  if (!batchId) {
    return NextResponse.json({ error: 'Thiếu batchId.' }, { status: 400 })
  }

  const user = await getUserOrBypass()
  if (!user) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
  }

  const items = await fetchTryOnHistoryBatchDownloadRowsPg(user.id, batchId)
  if (items === null) {
    return NextResponse.json({ error: 'Không đọc được dữ liệu lô.' }, { status: 500 })
  }

  const rows = items as TryOnRow[]
  const completed = rows.filter((row) => row.result_image_url)
  if (completed.length === 0) {
    return NextResponse.json({ error: 'Không có ảnh đã xử lý xong để tải.' }, { status: 400 })
  }

  const isPdfBatch = rows.some((row) => row.batch_type === 'pdf')
  const wantPdf = request.nextUrl.searchParams.get('format') === 'pdf'
  const pagePrefix = isPdfBatch ? 'trang' : 'image'
  const ordered = orderPages(completed)

  try {
    const resultEntries: Array<{ name: string; buffer: Buffer }> = []
    for (let i = 0; i < ordered.length; i++) {
      try {
        const res = await fetch(ordered[i].result_image_url!, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) continue
        resultEntries.push({ name: `${pagePrefix}_${i + 1}_dich.png`, buffer: Buffer.from(await res.arrayBuffer()) })
      } catch {
        /* bỏ trang lỗi */
      }
    }
    if (resultEntries.length === 0) {
      return NextResponse.json({ error: 'Không tải được ảnh kết quả để nén.' }, { status: 500 })
    }
    const originalZipUrl = await zipOriginalPages(user.id, ordered, pagePrefix)
    if (wantPdf) {
      const pdfUrl = await pagesToPdfUrl(user.id, resultEntries.map((entry) => entry.buffer))
      return NextResponse.json({ pdfUrl, originalZipUrl })
    }
    const resultZip = await zipBuffers(resultEntries)
    const { publicUrl: zipUrl } = await uploadTryOnImagePublic(`results/${user.id}/dich_tai_lieu_${Date.now()}.zip`, resultZip, {
      contentType: 'application/zip',
      upsert: true,
    })
    return NextResponse.json({ zipUrl, originalZipUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[batch-download] Lỗi:', msg)
    return NextResponse.json({ error: `Không tạo được file: ${msg}` }, { status: 500 })
  }
}
