/**
 * Tạo PDF Dieline chuẩn in cho hộp carton.
 * - Đường bế (Cut) và đường cấn (Crease) là vector, phân biệt bằng màu/nét
 * - Artwork khớp mép panel (fill) rồi tràn bleed 3mm bằng edge extend
 * - Net hộp nắp gài có tai dán, nắp trên/dưới và tai bụi
 * - Mỗi mặt hộp (top/front/right/bottom/back/left) dùng ảnh riêng; mặt trống = nền trắng
 */

import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { getBoxDielineLayoutData, type BoxDimensions } from '@/lib/packaging/box-net-svg'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import {
  DEFAULT_BOX_DIELINE_STRUCTURE,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import {
  DEFAULT_PANEL_BLEED_MM,
  mmToPrintPx,
  preparePanelArtworkForDieline,
} from '@/lib/packaging/panel-artwork-fit'

const MM_TO_PT = 2.834645669
const PAGE_MARGIN_MM = 5

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
  /** Hybrid layout source; placed once across front|right|back|left. */
  bodyStripBuffer?: Buffer
  boxLength: number
  boxWidth: number
  boxHeight: number
  bleedMm?: number
  production?: Partial<TuckBoxProductionParams>
  structure?: BoxDielineStructure
}

/**
 * Tạo PDF Dieline: ghép ảnh từng mặt vào net nắp gài, vẽ Cut (đỏ)
 * và Crease (xanh nét đứt), artwork có bleed thật.
 */
export async function createBoxDielinePdf(input: BoxDielineInput): Promise<Buffer> {
  const {
    slotBuffers,
    bodyStripBuffer,
    boxLength,
    boxWidth,
    boxHeight,
    production,
    structure = DEFAULT_BOX_DIELINE_STRUCTURE,
  } = input
  const bleedMm = input.bleedMm ?? production?.bleedMm ?? DEFAULT_PANEL_BLEED_MM
  const effectiveBodyStripBuffer =
    structure === 'straight_tuck' ? bodyStripBuffer : undefined

  const d: BoxDimensions = { lengthMm: boxLength, widthMm: boxWidth, heightMm: boxHeight }
  const { panels, cutSegments, foldSegments, bounds } = getBoxDielineLayoutData(
    structure,
    d,
    production
  )

  const netWidthMm = bounds.widthMm
  const netHeightMm = bounds.heightMm
  const contentW = netWidthMm + 2 * bleedMm
  const contentH = netHeightMm + 2 * bleedMm
  const pageW = contentW + 2 * PAGE_MARGIN_MM
  const pageH = contentH + 2 * PAGE_MARGIN_MM

  const offsetMm = PAGE_MARGIN_MM
  const offsetPt = offsetMm * MM_TO_PT

  const imgWpx = mmToPrintPx(contentW)
  const imgHpx = mmToPrintPx(contentH)

  const bleedOps: { input: Buffer; left: number; top: number }[] = []
  const trimOps: { input: Buffer; left: number; top: number }[] = []
  const sideSlots = new Set<BoxFaceSlot>(['front', 'right', 'back', 'left'])

  if (effectiveBodyStripBuffer) {
    const front = panels.find((panel) => panel.slot === 'front')!
    const stripWidthMm = 2 * (boxLength + boxWidth)
    const prepared = await preparePanelArtworkForDieline(
      effectiveBodyStripBuffer,
      stripWidthMm,
      boxHeight,
      bleedMm
    )
    bleedOps.push({
      input: prepared.bleedBuffer,
      left: mmToPrintPx(front.x),
      top: mmToPrintPx(front.y),
    })
    trimOps.push({
      input: prepared.trimBuffer,
      left: mmToPrintPx(bleedMm + front.x),
      top: mmToPrintPx(bleedMm + front.y),
    })
  }

  for (const panel of panels) {
    if (effectiveBodyStripBuffer && sideSlots.has(panel.slot)) continue
    const wPx = Math.max(1, mmToPrintPx(panel.w))
    const hPx = Math.max(1, mmToPrintPx(panel.h))

    const rawBuf = slotBuffers[panel.slot]
    const faceBuf = rawBuf ?? (await whitePanelBuffer(wPx, hPx))
    const prepared = await preparePanelArtworkForDieline(faceBuf, panel.w, panel.h, bleedMm)

    bleedOps.push({
      input: prepared.bleedBuffer,
      left: mmToPrintPx(panel.x),
      top: mmToPrintPx(panel.y),
    })
    trimOps.push({
      input: prepared.trimBuffer,
      left: mmToPrintPx(bleedMm + panel.x),
      top: mmToPrintPx(bleedMm + panel.y),
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
  const productionSummary = production
    ? `; bleed=${bleedMm}mm; glue-tab=${production.glueTabMm ?? 'auto'}mm; paper=${production.paperThicknessMm ?? 'unspecified'}mm; clearance=${production.compensationGapMm ?? 0}mm`
    : `; bleed=${bleedMm}mm`
  const structureLabel = structure === 'cross_fold' ? 'Cross-fold carton' : 'Straight-tuck carton'
  pdfDoc.setSubject(`${structureLabel} dieline: red solid = cut, green dashed = crease${productionSummary}`)
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
