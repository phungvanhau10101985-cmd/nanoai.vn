'use server'

import { getUserForAction } from '@/lib/auth'
import { createPrintReadyPdf } from '@/lib/print-ready-pdf'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

/**
 * Tạo PDF chuẩn in từ ảnh nhãn base64.
 */
export async function generateCylinderLabelPdf(
  imageBase64: string,
  widthMm: number,
  heightMm: number
): Promise<{ pdfUrl: string } | { error: string }> {
  if (!imageBase64?.trim()) return { error: 'Thiếu dữ liệu ảnh.' }
  if (widthMm < 10 || widthMm > 800 || heightMm < 10 || heightMm > 800) {
    return { error: 'Kích thước phải từ 10–800 mm.' }
  }

  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  if (!bunnyStorageConfigured()) {
    return { error: 'Thiếu cấu hình lưu file (Bunny Storage).' }
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const pdfBuffer = await createPrintReadyPdf(imageBuffer, { widthMm, heightMm })

    const pdfPath = `results/${user.id}/cylinder_label_${Date.now()}.pdf`
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
