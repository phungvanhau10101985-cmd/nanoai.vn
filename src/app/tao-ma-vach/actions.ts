'use server'

import {
  generateBarcodeBuffer,
  validateBarcodeContent,
  type BarcodeType,
} from '@/lib/barcode/generate-barcode'

export type { BarcodeType } from '@/lib/barcode/generate-barcode'

/** Tạo mã vạch / QR code. Miễn phí, không dùng AI. */
export async function generateBarcode(
  type: BarcodeType,
  content: string,
  size: number = 256
): Promise<{ error?: string; dataUrl?: string }> {
  const trimmed = (content || '').trim()
  const validationError = validateBarcodeContent(type, trimmed)
  if (validationError) return { error: validationError }

  try {
    const png = await generateBarcodeBuffer(type, trimmed, size)
    const base64 = Buffer.from(png).toString('base64')
    return { dataUrl: `data:image/png;base64,${base64}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/invalid|invalid character/i.test(msg)) {
      return { error: `Nội dung không hợp lệ cho ${type.toUpperCase()}. Kiểm tra định dạng.` }
    }
    return { error: `Tạo mã vạch thất bại: ${msg}` }
  }
}

const VIETQR_BASE = 'https://img.vietqr.io/image'

/** Lấy ảnh VietQR từ VietQR.io (proxy để tải xuống). */
export async function fetchVietQRImage(vietqrUrl: string): Promise<{ error?: string; dataUrl?: string }> {
  const trimmed = (vietqrUrl || '').trim()
  if (!trimmed || !trimmed.startsWith(VIETQR_BASE)) {
    return { error: 'URL VietQR không hợp lệ.' }
  }
  try {
    const res = await fetch(trimmed)
    if (res.status === 429) return { error: 'VietQR.io tạm thời giới hạn. Vui lòng thử lại sau vài phút.' }
    if (!res.ok) return { error: `VietQR.io trả về ${res.status}. Thử lại sau.` }
    const buf = Buffer.from(await res.arrayBuffer())
    const base64 = buf.toString('base64')
    return { dataUrl: `data:image/png;base64,${base64}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Không tải được ảnh: ${msg}` }
  }
}
