import { NextRequest, NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import archiver from 'archiver'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchTryOnHistoryBatchDownloadRowsPg } from '@/lib/db/translate-process-pg'
import { pdfPageNumberFromUrl } from '@/lib/dich-anh-tai-lieu/pdf-page-selection'
import { loadPdfLinesFile, loadPdfPageMeta, loadPdfVectorPage } from '@/lib/dich-anh-tai-lieu/pdf-job-files'
import { buildPdfFromTranslatedPages } from '@/lib/dich-anh-tai-lieu/pdf-page-paint'

/** Route Handler cho tải PDF/zip – timeout 120s (Server Action chỉ 15s trên Vercel) */
export const maxDuration = 120

type TryOnRow = { id?: string; result_image_url?: string | null; batch_type?: string | null; original_image_url?: string | null }

function pageIndex(url: string | null | undefined): number | null {
  const page = pdfPageNumberFromUrl(url)
  return page == null ? null : page - 1
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

async function pagesToPdfUrl(userId: string, rows: TryOnRow[], pngs: Buffer[]): Promise<string> {
  const pages = []
  for (let i = 0; i < pngs.length; i++) {
    const row = rows[i]
    const linesFile = row?.result_image_url ? await loadPdfLinesFile(row.result_image_url) : null
    const meta = row?.original_image_url ? await loadPdfPageMeta(row.original_image_url) : null
    const vectorPdf = row?.result_image_url ? await loadPdfVectorPage(row.result_image_url) : null
    pages.push({
      png: pngs[i],
      vectorPdf,
      widthPt: linesFile?.widthPt || meta?.widthPt || 0,
      heightPt: linesFile?.heightPt || meta?.heightPt || 0,
      lines: linesFile?.lines ?? [],
    })
  }
  const out = await buildPdfFromTranslatedPages(pages)
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
      const pageNo = pdfPageNumberFromUrl(origUrl) ?? i + 1
      entries.push({ name: `${pagePrefix}_${pageNo}_goc.png`, buffer: Buffer.from(await res.arrayBuffer()) })
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
  const picked = new Set(
    (request.nextUrl.searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  )
  const ordered = orderPages(picked.size > 0 ? completed.filter((row) => row.id && picked.has(row.id)) : completed)
  if (ordered.length === 0) {
    return NextResponse.json({ error: 'Chọn trang đã xong để tải.' }, { status: 400 })
  }

  try {
    const resultEntries: Array<{ name: string; buffer: Buffer; row: TryOnRow }> = []
    for (let i = 0; i < ordered.length; i++) {
      try {
        const res = await fetch(ordered[i].result_image_url!, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) continue
        const pageNo = pdfPageNumberFromUrl(ordered[i].original_image_url) ?? i + 1
        resultEntries.push({
          name: `${pagePrefix}_${pageNo}_dich.png`,
          buffer: Buffer.from(await res.arrayBuffer()),
          row: ordered[i],
        })
      } catch {
        /* bỏ trang lỗi */
      }
    }
    if (resultEntries.length === 0) {
      return NextResponse.json({ error: 'Không tải được ảnh kết quả để nén.' }, { status: 500 })
    }
    const originalZipUrl = await zipOriginalPages(user.id, ordered, pagePrefix)
    if (wantPdf) {
      const pdfUrl = await pagesToPdfUrl(
        user.id,
        resultEntries.map((entry) => entry.row),
        resultEntries.map((entry) => entry.buffer)
      )
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
