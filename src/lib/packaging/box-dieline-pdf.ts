/**
 * PDF dieline chuẩn in: hình CMYK tràn bleed, nét cắt/gấp là màu pha.
 */

import { getBoxDielineLayoutData, type BoxDimensions } from '@/lib/packaging/box-net-svg'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import {
  normalizeTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'
import {
  boxDielineStructureCopy,
  DEFAULT_BOX_DIELINE_STRUCTURE,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'
import { composeDielineRaster, type DielineWarning } from '@/lib/packaging/dieline-artwork'
import { createPrintDielinePdf } from '@/lib/packaging/dieline-print-pdf'
import { buildBlankDielineDxf, buildBlankDielineSvg } from '@/lib/packaging/dieline-blank-files'
import {
  DEFAULT_PANEL_BLEED_MM,
  resolveDielineRasterDpi,
  SHARP_SAFE_CANVAS_PIXELS,
  mmToPrintPx,
} from '@/lib/packaging/panel-artwork-fit'
import { lidDepthExtraMm, TUCK_SIDE_RELIEF_MM } from '@/lib/packaging/paper-stock'

export interface BoxDielineInput {
  slotBuffers: Partial<Record<BoxFaceSlot, Buffer>>
  /** Hybrid layout source; sliced across front|right|back|left when the structure uses a body strip. */
  bodyStripBuffer?: Buffer
  boxLength: number
  boxWidth: number
  boxHeight: number
  bleedMm?: number
  production?: Partial<TuckBoxProductionParams>
  structure?: BoxDielineStructure
}

export async function createBoxDielinePdf(
  input: BoxDielineInput
): Promise<{ pdfBuffer: Buffer; resolutionDpi: number; warnings: DielineWarning[] }> {
  const built = await buildDielinePackage(input)
  return {
    pdfBuffer: built.pdfBuffer,
    resolutionDpi: built.resolutionDpi,
    warnings: built.warnings,
  }
}

export async function createBoxDielinePackage(input: BoxDielineInput): Promise<{
  pdfBuffer: Buffer
  blankPdfBuffer: Buffer
  blankSvg: string
  blankDxf: string
  resolutionDpi: number
  warnings: DielineWarning[]
}> {
  return buildDielinePackage(input)
}

async function buildDielinePackage(input: BoxDielineInput) {
  const structure = input.structure ?? DEFAULT_BOX_DIELINE_STRUCTURE
  const production = normalizeTuckBoxProductionParams(
    { ...input.production, bleedMm: input.bleedMm ?? input.production?.bleedMm },
    input.boxHeight
  )
  const bleedMm = production.bleedMm || DEFAULT_PANEL_BLEED_MM
  const d: BoxDimensions = {
    lengthMm: input.boxLength,
    widthMm: input.boxWidth,
    heightMm: input.boxHeight,
  }
  const layout = getBoxDielineLayoutData(structure, d, production)
  const contentW = layout.bounds.widthMm + bleedMm * 2
  const contentH = layout.bounds.heightMm + bleedMm * 2
  const rasterDpi = resolveDielineRasterDpi(contentW, contentH)
  const imgWpx = mmToPrintPx(contentW, rasterDpi)
  const imgHpx = mmToPrintPx(contentH, rasterDpi)
  if (imgWpx * imgHpx > SHARP_SAFE_CANVAS_PIXELS) {
    throw new Error('Input image exceeds pixel limit')
  }
  const { png, warnings } = await composeDielineRaster({
    layout,
    slotBuffers: input.slotBuffers,
    bodyStripBuffer: input.bodyStripBuffer,
    boxLengthMm: input.boxLength,
    boxWidthMm: input.boxWidth,
    boxHeightMm: input.boxHeight,
    bleedMm,
    dpi: rasterDpi,
    safeZoneMm: production.safeZoneMm,
  })
  const style = boxDielineStructureCopy(structure, 'vi').label
  const tuckLid =
    structure === 'straight_tuck' ||
    structure === 'reverse_tuck' ||
    structure === 'crash_lock' ||
    structure === 'snap_lock' ||
    structure === 'window' ||
    structure === 'handle' ||
    structure === 'bottle' ||
    structure === 'hexagon' ||
    structure === 'octagon' ||
    structure === 'cross_fold'
  const legend = [
    `${style} · ${input.boxLength}×${input.boxWidth}×${input.boxHeight} mm`,
    structure === 'insert'
      ? 'Lót không dùng bleed và không có tai dán.'
      : `Bleed ${bleedMm} mm · vùng an toàn ${production.safeZoneMm} mm`,
    `Giấy ${production.paperStock} ${production.paperThicknessMm} mm${
      tuckLid
        ? ` · nắp/đáy +${lidDepthExtraMm(production.paperThicknessMm)} mm · hẹp lưỡi ${TUCK_SIDE_RELIEF_MM} mm/bên`
        : ''
    }`,
    structure === 'insert'
      ? 'Nét cắt CutContour, nét gấp Crease. Không có ảnh in.'
      : 'Nét cắt CutContour, nét gấp Crease, overprint. Ảnh in là raster; nét cắt và nét gấp là vector.',
    ...(layout.legendLines ?? []),
  ]
  const title = `Box dieline ${style} ${input.boxLength}x${input.boxWidth}x${input.boxHeight} mm`
  const [pdfBuffer, blankPdfBuffer] = await Promise.all([
    createPrintDielinePdf({
      artworkPng: png,
      layout,
      bleedMm,
      safeZoneMm: production.safeZoneMm,
      legend,
      warnings,
      title,
    }),
    createPrintDielinePdf({
      layout,
      bleedMm,
      safeZoneMm: production.safeZoneMm,
      legend: [...legend, 'File trắng cho máy bế. Không kèm hình.'],
      warnings: [],
      title: `${title} blank`,
    }),
  ])
  return {
    pdfBuffer,
    blankPdfBuffer,
    blankSvg: buildBlankDielineSvg(layout),
    blankDxf: buildBlankDielineDxf(layout),
    resolutionDpi: rasterDpi,
    warnings,
  }
}
