import { createBoxDielinePackage } from '@/lib/packaging/box-dieline-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { BOX_FACE_SLOT_ORDER, type BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { TuckBoxProductionParams } from './tuck-box-production'
import {
  boxDielineStructureSlug,
  DEFAULT_BOX_DIELINE_STRUCTURE,
  type BoxDielineStructure,
} from './dieline-structure'
import { ensureImageWithinLimits } from '@/lib/ensure-image-limits'
import type { DielineWarning } from '@/lib/packaging/dieline-artwork'

export type DielineSlotUrls = Partial<Record<BoxFaceSlot, string>>

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Không tải được ảnh mặt hộp (${response.status}).`)
  const raw = Buffer.from(await response.arrayBuffer())
  return ensureImageWithinLimits(raw)
}

export type ExportedBoxDieline = {
  pdfUrl: string
  fileName: string
  resolutionDpi?: number
  warnings: DielineWarning[]
  cutter: {
    pdfUrl: string
    svgUrl: string
    dxfUrl: string
    pdfFileName: string
    svgFileName: string
    dxfFileName: string
  }
}

export async function exportBoxDielineFromUrls(input: {
  userId: string
  slotUrls: DielineSlotUrls
  dimensionsMm: BoxDimensionsMm
  bodyStripUrl?: string
  production?: TuckBoxProductionParams
  structure?: BoxDielineStructure
}): Promise<ExportedBoxDieline> {
  const structure = input.structure ?? DEFAULT_BOX_DIELINE_STRUCTURE
  const slotBuffers: Partial<Record<BoxFaceSlot, Buffer>> = {}
  await Promise.all(
    BOX_FACE_SLOT_ORDER.map(async (slot) => {
      const url = input.slotUrls[slot]
      if (!url) return
      slotBuffers[slot] = await fetchImageBuffer(url)
    })
  )
  const bodyStripBuffer = input.bodyStripUrl ? await fetchImageBuffer(input.bodyStripUrl) : undefined
  const packed = await createBoxDielinePackage({
    slotBuffers,
    bodyStripBuffer,
    boxLength: input.dimensionsMm.length,
    boxWidth: input.dimensionsMm.width,
    boxHeight: input.dimensionsMm.height,
    production: input.production,
    structure,
  })
  const stamp = Date.now()
  const slug = boxDielineStructureSlug(structure)
  const size = `${input.dimensionsMm.length}x${input.dimensionsMm.width}x${input.dimensionsMm.height}mm`
  const fileName = `box-dieline-${slug}-${size}.pdf`
  const blankPdfName = `box-dieline-${slug}-${size}-blank.pdf`
  const svgName = `box-dieline-${slug}-${size}.svg`
  const dxfName = `box-dieline-${slug}-${size}.dxf`
  const base = `results/${input.userId}/box_dieline_${slug}_${stamp}`
  const [pdf, blankPdf, svg, dxf] = await Promise.all([
    uploadTryOnImagePublic(`${base}.pdf`, packed.pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    }),
    uploadTryOnImagePublic(`${base}-blank.pdf`, packed.blankPdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    }),
    uploadTryOnImagePublic(`${base}.svg`, Buffer.from(packed.blankSvg), {
      contentType: 'image/svg+xml',
      upsert: true,
    }),
    uploadTryOnImagePublic(`${base}.dxf`, Buffer.from(packed.blankDxf), {
      contentType: 'application/dxf',
      upsert: true,
    }),
  ])
  return {
    pdfUrl: pdf.publicUrl,
    fileName,
    resolutionDpi: packed.resolutionDpi,
    warnings: packed.warnings,
    cutter: {
      pdfUrl: blankPdf.publicUrl,
      svgUrl: svg.publicUrl,
      dxfUrl: dxf.publicUrl,
      pdfFileName: blankPdfName,
      svgFileName: svgName,
      dxfFileName: dxfName,
    },
  }
}
