'use server'

import QRCode from 'qrcode'
import bwipjs from 'bwip-js/node'

export type BarcodeType = 'qrcode' | 'ean13' | 'upca' | 'code128'

/** Tạo mã vạch / QR code. Miễn phí, không dùng AI. */
export async function generateBarcode(
  type: BarcodeType,
  content: string,
  size: number = 256
): Promise<{ error?: string; dataUrl?: string }> {
  const trimmed = (content || '').trim()
  if (!trimmed) {
    return { error: 'Vui lòng nhập nội dung cần mã hóa.' }
  }

  try {
    if (type === 'qrcode') {
      const dataUrl = await QRCode.toDataURL(trimmed, {
        width: Math.min(Math.max(size, 128), 1024),
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })
      return { dataUrl }
    }

    // 1D barcodes via bwip-js
    const bcid = type === 'ean13' ? 'ean13' : type === 'upca' ? 'upca' : 'code128'
    if (bcid === 'ean13' && !/^\d{13}$/.test(trimmed)) {
      return { error: 'EAN-13 cần đúng 13 chữ số.' }
    }
    if (bcid === 'upca' && !/^\d{12}$/.test(trimmed)) {
      return { error: 'UPC-A cần đúng 12 chữ số.' }
    }

    const png = await bwipjs.toBuffer({
      bcid,
      text: trimmed,
      scale: Math.min(Math.max(Math.round(size / 128), 2), 8),
      padding: 10,
      includetext: true,
    })
    const base64 = png.toString('base64')
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
