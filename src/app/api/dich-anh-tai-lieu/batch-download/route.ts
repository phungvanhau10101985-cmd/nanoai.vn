import { NextRequest, NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import archiver from 'archiver'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchTryOnHistoryBatchDownloadRowsPg } from '@/lib/db/translate-process-pg'

/** Route Handler cho tải PDF/zip – timeout 120s (Server Action chỉ 15s trên Vercel) */
export const maxDuration = 120

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

  type TryOnRow = { result_image_url?: string | null; batch_type?: string | null; original_image_url?: string | null }
  const rows = items as TryOnRow[]
  const completed = rows.filter((x) => x.result_image_url)
  if (completed.length === 0) {
    return NextResponse.json({ error: 'Không có ảnh đã xử lý xong để tải.' }, { status: 400 })
  }

  const isPdfBatch = rows.some((x) => x.batch_type === 'pdf')
  const pagePrefix = isPdfBatch ? 'trang' : 'image'

  try {
    // Zip ảnh kết quả (đã dịch)
    const resultZipEntries: Array<{ name: string; buffer: Buffer }> = []
    for (let i = 0; i < completed.length; i++) {
      try {
        const res = await fetch(completed[i].result_image_url!, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) continue
        const buf = Buffer.from(await res.arrayBuffer())
        resultZipEntries.push({ name: `${pagePrefix}_${i + 1}_dich.png`, buffer: buf })
      } catch {
        // skip
      }
    }
    if (resultZipEntries.length === 0) {
      return NextResponse.json({ error: 'Không tải được ảnh kết quả để nén.' }, { status: 500 })
    }
    const resultZipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } })
      const chunks: Buffer[] = []
      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
      for (const e of resultZipEntries) {
        archive.append(e.buffer, { name: e.name })
      }
      archive.finalize()
    })
    const resultZipPath = `results/${user.id}/dich_tai_lieu_${Date.now()}.zip`
    const { publicUrl: resultZipPublicUrl } = await uploadTryOnImagePublic(resultZipPath, resultZipBuffer, {
      contentType: 'application/zip',
      upsert: true,
    })

    // Zip ảnh gốc
    const originalZipEntries: Array<{ name: string; buffer: Buffer }> = []
    for (let i = 0; i < completed.length; i++) {
      const origUrl = (completed[i] as { original_image_url?: string }).original_image_url
      if (!origUrl) continue
      try {
        const res = await fetch(origUrl, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) continue
        const buf = Buffer.from(await res.arrayBuffer())
        originalZipEntries.push({ name: `${pagePrefix}_${i + 1}_goc.png`, buffer: buf })
      } catch {
        // skip
      }
    }
    let originalZipUrl: string | undefined
    if (originalZipEntries.length > 0) {
      const originalZipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } })
        const chunks: Buffer[] = []
        archive.on('data', (chunk: Buffer) => chunks.push(chunk))
        archive.on('end', () => resolve(Buffer.concat(chunks)))
        archive.on('error', reject)
        for (const e of originalZipEntries) {
          archive.append(e.buffer, { name: e.name })
        }
        archive.finalize()
      })
      const originalZipPath = `results/${user.id}/dich_tai_lieu_goc_${Date.now()}.zip`
      const { publicUrl: originalZipPublicUrl } = await uploadTryOnImagePublic(originalZipPath, originalZipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      })
      originalZipUrl = originalZipPublicUrl
    }

    return NextResponse.json({ zipUrl: resultZipPublicUrl, originalZipUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[batch-download] Lỗi:', msg)
    return NextResponse.json({ error: `Không tạo được file: ${msg}` }, { status: 500 })
  }
}
