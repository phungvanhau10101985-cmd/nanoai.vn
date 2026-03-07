/**
 * Tạo PDF Dieline chuẩn in cho hộp carton.
 * - Layer đường cắt (Cut) và đường cấn (Crease) tách biệt
 * - Bleed 3–5mm
 * - 3 ảnh mặt ghép vào layout net
 */

import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { getSleeveLayoutData, type BoxDimensions } from './box-net-svg'

const MM_TO_PT = 2.834645669
const BLEED_MM = 3
const CROP_MARK_LENGTH_MM = 5
const CROP_MARK_THICKNESS = 0.25
const PRINT_DPI = 300
const MM_TO_PX = (mm: number) => Math.round((mm * PRINT_DPI) / 25.4)

export interface BoxDielineInput {
  face1Buffer: Buffer
  face2Buffer: Buffer
  face3Buffer: Buffer
  boxLength: number
  boxWidth: number
  boxHeight: number
  bleedMm?: number
}

/**
 * Tạo PDF Dieline: ghép 3 ảnh mặt vào net, vẽ Cut (đỏ) và Crease (xanh nét đứt), bleed, crop marks.
 */
export async function createBoxDielinePdf(input: BoxDielineInput): Promise<Buffer> {
  const { face1Buffer, face2Buffer, face3Buffer, boxLength, boxWidth, boxHeight, bleedMm = BLEED_MM } = input

  const d: BoxDimensions = { lengthMm: boxLength, widthMm: boxWidth, heightMm: boxHeight }
  const { panels, cutSegments, foldSegments, bounds } = getSleeveLayoutData(d)

  const netWidthMm = bounds.widthMm
  const netHeightMm = bounds.heightMm
  const contentW = netWidthMm + 2 * bleedMm
  const contentH = netHeightMm + 2 * bleedMm
  const pageW = contentW + 2 * CROP_MARK_LENGTH_MM
  const pageH = contentH + 2 * CROP_MARK_LENGTH_MM

  const offsetMm = CROP_MARK_LENGTH_MM
  const offsetPt = offsetMm * MM_TO_PT

  const imgWpx = MM_TO_PX(contentW)
  const imgHpx = MM_TO_PX(contentH)

  const faceBuffers = [face1Buffer, face2Buffer, face3Buffer] as const

  const compositeOps: { input: Buffer; left: number; top: number }[] = []

  for (const panel of panels) {
    const faceBuf = faceBuffers[panel.faceIndex - 1]
    const wPx = Math.max(1, MM_TO_PX(panel.w))
    const hPx = Math.max(1, MM_TO_PX(panel.h))
    const leftPx = MM_TO_PX(bleedMm + panel.x)
    const topPx = MM_TO_PX(bleedMm + panel.y)

    const resized = await sharp(faceBuf)
      .resize(wPx, hPx, { fit: 'cover', position: 'center' })
      .png()
      .toBuffer()

    compositeOps.push({
      input: resized,
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
    .composite(compositeOps)
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
    })
  }

  const black = rgb(0, 0, 0)
  const trimLeft = offsetMm + bleedMm
  const trimBottom = offsetMm + bleedMm
  const trimRight = trimLeft + netWidthMm
  const trimTop = trimBottom + netHeightMm

  const drawCropLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: pt(x1), y: pt(y1) },
      end: { x: pt(x2), y: pt(y2) },
      thickness: CROP_MARK_THICKNESS,
      color: black,
    })
  }

  drawCropLine(trimLeft - CROP_MARK_LENGTH_MM, trimBottom, trimLeft, trimBottom)
  drawCropLine(trimLeft, trimBottom - CROP_MARK_LENGTH_MM, trimLeft, trimBottom)
  drawCropLine(trimRight, trimBottom, trimRight + CROP_MARK_LENGTH_MM, trimBottom)
  drawCropLine(trimRight, trimBottom - CROP_MARK_LENGTH_MM, trimRight, trimBottom)
  drawCropLine(trimLeft - CROP_MARK_LENGTH_MM, trimTop, trimLeft, trimTop)
  drawCropLine(trimLeft, trimTop, trimLeft, trimTop + CROP_MARK_LENGTH_MM)
  drawCropLine(trimRight, trimTop, trimRight + CROP_MARK_LENGTH_MM, trimTop)
  drawCropLine(trimRight, trimTop, trimRight, trimTop + CROP_MARK_LENGTH_MM)

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
