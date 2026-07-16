/**
 * Tạo PDF Dieline chuẩn in cho hộp carton.
 * - Đường bế (Cut) và đường cấn (Crease) là vector, phân biệt bằng màu/nét
 * - Artwork tràn 3mm ra ngoài mép bế
 * - Net hộp nắp gài có tai dán, nắp trên/dưới và tai bụi
 * - Mỗi mặt hộp (top/front/right/bottom/back/left) dùng ảnh riêng; mặt trống = nền trắng
 */

import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { getTuckEndLayoutData, type BoxDimensions } from './box-net-svg'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'

const MM_TO_PT = 2.834645669
const BLEED_MM = 3
const PAGE_MARGIN_MM = 5
const PRINT_DPI = 300
const MM_TO_PX = (mm: number) => Math.round((mm * PRINT_DPI) / 25.4)

async function whitePanelBuffer(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({
    create: {
      width: Math.max(1, widthPx),
      height: Math.max(1, heightPx),
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

export interface BoxDielineInput {
  slotBuffers: Partial<Record<BoxFaceSlot, Buffer>>
  boxLength: number
  boxWidth: number
  boxHeight: number
  bleedMm?: number
}

/**
 * Tạo PDF Dieline: ghép ảnh từng mặt vào net nắp gài, vẽ Cut (đỏ)
 * và Crease (xanh nét đứt), artwork có bleed thật.
 */
export async function createBoxDielinePdf(input: BoxDielineInput): Promise<Buffer> {
  const { slotBuffers, boxLength, boxWidth, boxHeight, bleedMm = BLEED_MM } = input

  const d: BoxDimensions = { lengthMm: boxLength, widthMm: boxWidth, heightMm: boxHeight }
  const { panels, cutSegments, foldSegments, bounds } = getTuckEndLayoutData(d)

  const netWidthMm = bounds.widthMm
  const netHeightMm = bounds.heightMm
  const contentW = netWidthMm + 2 * bleedMm
  const contentH = netHeightMm + 2 * bleedMm
  const pageW = contentW + 2 * PAGE_MARGIN_MM
  const pageH = contentH + 2 * PAGE_MARGIN_MM

  const offsetMm = PAGE_MARGIN_MM
  const offsetPt = offsetMm * MM_TO_PT

  const imgWpx = MM_TO_PX(contentW)
  const imgHpx = MM_TO_PX(contentH)

  const bleedOps: { input: Buffer; left: number; top: number }[] = []
  const trimOps: { input: Buffer; left: number; top: number }[] = []

  for (const panel of panels) {
    const wPx = Math.max(1, MM_TO_PX(panel.w))
    const hPx = Math.max(1, MM_TO_PX(panel.h))
    const bleedWPx = Math.max(1, MM_TO_PX(panel.w + 2 * bleedMm))
    const bleedHPx = Math.max(1, MM_TO_PX(panel.h + 2 * bleedMm))
    const leftPx = MM_TO_PX(bleedMm + panel.x)
    const topPx = MM_TO_PX(bleedMm + panel.y)

    const rawBuf = slotBuffers[panel.slot]
    const faceBuf = rawBuf ?? (await whitePanelBuffer(wPx, hPx))
    const source = sharp(faceBuf)
    const bleedImage = await source
      .clone()
      .resize(bleedWPx, bleedHPx, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()
    const trimImage = await source
      .clone()
      .resize(wPx, hPx, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()

    bleedOps.push({
      input: bleedImage,
      left: MM_TO_PX(panel.x),
      top: MM_TO_PX(panel.y),
    })
    trimOps.push({
      input: trimImage,
      left: leftPx,
      top: topPx,
    })
  }

  const baseImage = sharp({
    create: {
      width: imgWpx,
      height: imgHpx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })

  const pngBuffer = await baseImage
    // Bleed đặt trước, artwork đúng khổ đặt sau để vùng trim không bị
    // artwork của panel liền kề ghi đè.
    .composite([...bleedOps, ...trimOps])
    .png({ compressionLevel: 4 })
    .toBuffer()

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageW * MM_TO_PT, pageH * MM_TO_PT])

  const image = await pdfDoc.embedPng(pngBuffer)
  page.drawImage(image, {
    x: offsetPt,
    y: offsetPt,
    width: contentW * MM_TO_PT,
    height: contentH * MM_TO_PT,
  })

  const cutColor = rgb(0.86, 0.15, 0.15)
  const creaseColor = rgb(0.09, 0.64, 0.33)

  const pt = (mm: number) => mm * MM_TO_PT
  const toPageX = (x: number) => offsetPt + (bleedMm + x) * MM_TO_PT
  const toPageY = (y: number) => offsetPt + (netHeightMm + bleedMm - y) * MM_TO_PT

  for (const [x1, y1, x2, y2] of cutSegments) {
    page.drawLine({
      start: { x: toPageX(x1), y: toPageY(y1) },
      end: { x: toPageX(x2), y: toPageY(y2) },
      thickness: 0.4,
      color: cutColor,
    })
  }

  for (const [x1, y1, x2, y2] of foldSegments) {
    page.drawLine({
      start: { x: toPageX(x1), y: toPageY(y1) },
      end: { x: toPageX(x2), y: toPageY(y2) },
      thickness: 0.3,
      color: creaseColor,
      dashArray: [pt(3), pt(2)],
    })
  }

  pdfDoc.setTitle(`Box dieline ${boxLength}x${boxWidth}x${boxHeight} mm`)
  pdfDoc.setSubject('Straight-tuck carton dieline: red solid = cut, green dashed = crease')
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
