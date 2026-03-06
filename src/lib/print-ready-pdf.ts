/**
 * Tạo PDF chuẩn in (print-ready) với bleed, crop marks, kích thước mm chính xác.
 * Dùng cho nhãn, sticker, bao bì.
 */

import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

const MM_TO_PT = 2.834645669
const BLEED_MM = 3
const CROP_MARK_LENGTH_MM = 5
const CROP_MARK_THICKNESS = 0.25

export interface PrintReadyOptions {
  widthMm: number
  heightMm: number
  bleedMm?: number
}

/**
 * Tạo PDF chuẩn in từ buffer ảnh.
 * - Kích thước trim chính xác theo mm
 * - Bleed 3mm mỗi cạnh
 * - Crop marks tại 4 góc
 */
export async function createPrintReadyPdf(
  imageBuffer: Buffer,
  options: PrintReadyOptions
): Promise<Buffer> {
  const { widthMm, heightMm, bleedMm = BLEED_MM } = options

  const contentW = widthMm + 2 * bleedMm
  const contentH = heightMm + 2 * bleedMm
  const pageW = contentW + 2 * CROP_MARK_LENGTH_MM
  const pageH = contentH + 2 * CROP_MARK_LENGTH_MM

  const pageWpt = pageW * MM_TO_PT
  const pageHpt = pageH * MM_TO_PT
  const contentWpt = contentW * MM_TO_PT
  const contentHpt = contentH * MM_TO_PT

  const offsetMm = CROP_MARK_LENGTH_MM
  const offsetPt = offsetMm * MM_TO_PT

  const trimLeft = offsetMm + bleedMm
  const trimBottom = offsetMm + bleedMm
  const trimRight = trimLeft + widthMm
  const trimTop = trimBottom + heightMm

  const trimLeftPt = trimLeft * MM_TO_PT
  const trimBottomPt = trimBottom * MM_TO_PT
  const trimRightPt = trimRight * MM_TO_PT
  const trimTopPt = trimTop * MM_TO_PT

  const pngBuffer = await sharp(imageBuffer)
    .resize(Math.round(contentWpt), Math.round(contentHpt), {
      fit: 'contain',
      position: 'center',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer()

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([pageWpt, pageHpt])

  const image = await pdfDoc.embedPng(pngBuffer)
  page.drawImage(image, {
    x: offsetPt,
    y: offsetPt,
    width: contentWpt,
    height: contentHpt,
  })

  const black = rgb(0, 0, 0)

  const drawCropLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: CROP_MARK_THICKNESS,
      color: black,
    })
  }

  const pt = (mm: number) => mm * MM_TO_PT

  drawCropLine(pt(trimLeft - CROP_MARK_LENGTH_MM), pt(trimBottom), pt(trimLeft), pt(trimBottom))
  drawCropLine(pt(trimLeft), pt(trimBottom - CROP_MARK_LENGTH_MM), pt(trimLeft), pt(trimBottom))

  drawCropLine(pt(trimRight), pt(trimBottom), pt(trimRight + CROP_MARK_LENGTH_MM), pt(trimBottom))
  drawCropLine(pt(trimRight), pt(trimBottom - CROP_MARK_LENGTH_MM), pt(trimRight), pt(trimBottom))

  drawCropLine(pt(trimLeft - CROP_MARK_LENGTH_MM), pt(trimTop), pt(trimLeft), pt(trimTop))
  drawCropLine(pt(trimLeft), pt(trimTop), pt(trimLeft), pt(trimTop + CROP_MARK_LENGTH_MM))

  drawCropLine(pt(trimRight), pt(trimTop), pt(trimRight + CROP_MARK_LENGTH_MM), pt(trimTop))
  drawCropLine(pt(trimRight), pt(trimTop), pt(trimRight), pt(trimTop + CROP_MARK_LENGTH_MM))

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
