import QRCode from 'qrcode'
import bwipjs from 'bwip-js/node'

export type BarcodeType = 'qrcode' | 'ean13' | 'upca' | 'code128'

export function validateBarcodeContent(type: BarcodeType, content: string): string | null {
  const value = content.trim()
  if (!value) return 'Vui lòng nhập nội dung cần mã hóa.'
  if (type === 'ean13' && !/^\d{13}$/.test(value)) return 'EAN-13 cần đúng 13 chữ số.'
  if (type === 'upca' && !/^\d{12}$/.test(value)) return 'UPC-A cần đúng 12 chữ số.'
  return null
}

export async function generateBarcodeBuffer(
  type: BarcodeType,
  content: string,
  size = 512
): Promise<Buffer> {
  const trimmed = content.trim()
  const validationError = validateBarcodeContent(type, trimmed)
  if (validationError) throw new Error(validationError)

  if (type === 'qrcode') {
    const dataUrl = await QRCode.toDataURL(trimmed, {
      width: Math.min(Math.max(size, 256), 1024),
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' },
    } as Parameters<typeof QRCode.toDataURL>[1])
    return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
  }

  const bcid = type === 'ean13' ? 'ean13' : type === 'upca' ? 'upca' : 'code128'
  return bwipjs.toBuffer({
    bcid,
    text: trimmed,
    scale: Math.min(Math.max(Math.round(size / 192), 2), 8),
    paddingwidth: 12,
    paddingheight: 12,
    backgroundcolor: 'FFFFFF',
    barcolor: '000000',
    includetext: true,
    textxalign: 'center',
  } as Parameters<typeof bwipjs.toBuffer>[0])
}

