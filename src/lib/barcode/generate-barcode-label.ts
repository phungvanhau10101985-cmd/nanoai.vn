import sharp from 'sharp'
import { generateBarcodeBuffer, type BarcodeType } from '@/lib/barcode/generate-barcode'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Build a downloadable white product barcode label while preserving the code quiet zone. */
export async function generateBarcodeLabelBuffer(input: {
  type: BarcodeType
  content: string
  brandName?: string
  productName?: string
  productCode?: string
}): Promise<Buffer> {
  const barcode = await generateBarcodeBuffer(input.type, input.content, 512)
  const metadata = await sharp(barcode).metadata()
  const codeWidth = metadata.width ?? 512
  const codeHeight = metadata.height ?? 260
  const width = Math.max(800, codeWidth + 160)
  const codeLine = escapeXml((input.productCode ?? input.content).trim())
  const headerHeight = input.brandName || input.productName ? 170 : 90
  const height = headerHeight + codeHeight + 100
  const title = escapeXml(input.brandName?.trim() || '')
  const subtitle = escapeXml(input.productName?.trim() || '')
  const header = Buffer.from(
    `<svg width="${width}" height="${headerHeight}">
      <rect width="100%" height="100%" fill="white"/>
      ${title ? `<text x="50%" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#111">${title}</text>` : ''}
      ${subtitle ? `<text x="50%" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#333">${subtitle}</text>` : ''}
      ${codeLine ? `<text x="50%" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#555">${codeLine}</text>` : ''}
    </svg>`
  )
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: header, left: 0, top: 0 },
      {
        input: barcode,
        left: Math.round((width - codeWidth) / 2),
        top: headerHeight,
      },
    ])
    .png()
    .toBuffer()
}

