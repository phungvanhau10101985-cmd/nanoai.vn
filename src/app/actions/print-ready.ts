'use server'

import { getUserForAction } from '@/lib/auth'
import { createPrintReadyPdf } from '@/lib/print-ready-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

/**
 * Tạo PDF chuẩn in từ URL ảnh.
 * Trả về URL PDF công khai (Bunny Storage) để tải về.
 */
export async function generatePrintReadyPdf(
  imageUrl: string,
  widthMm: number,
  heightMm: number
): Promise<{ pdfUrl: string } | { error: string }> {
  if (!imageUrl?.trim()) return { error: 'Thiếu URL ảnh.' }
  if (widthMm < 10 || widthMm > 500 || heightMm < 10 || heightMm > 500) {
    return { error: 'Kích thước phải từ 10–500 mm.' }
  }

  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  try {
    const res = await fetch(imageUrl, { cache: 'no-store' })
    if (!res.ok) return { error: 'Không tải được ảnh. Vui lòng thử lại.' }
    const imageBuffer = Buffer.from(await res.arrayBuffer())

    const pdfBuffer = await createPrintReadyPdf(imageBuffer, { widthMm, heightMm })

    const pdfPath = `results/${user.id}/print_ready_${Date.now()}.pdf`
    const { publicUrl: pdfPublicUrl } = await uploadTryOnImagePublic(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    return { pdfUrl: pdfPublicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Xuất PDF thất bại: ${msg}` }
  }
}
