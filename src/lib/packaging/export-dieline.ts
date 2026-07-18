import { createBoxDielinePdf } from '@/lib/packaging/box-dieline-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { BOX_FACE_SLOT_ORDER, getBoxFaceSlotDimensionsMm, type BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { TuckBoxProductionParams } from './tuck-box-production'
import {
  BOX_DIELINE_STRUCTURE_KEYS,
  boxDielineStructureSlug,
  type BoxDielineStructure,
} from './dieline-structure'
import { getBodyStripSizeMm } from './body-strip'
import { normalizePanelArtworkToPrintSize } from './panel-artwork-fit'
import sharp from 'sharp'

export type DielineSlotUrls = Partial<Record<BoxFaceSlot, string>>

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Không tải được ảnh mặt hộp (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

export async function exportBoxDielineFromUrls(input: {
  userId: string
  slotUrls: DielineSlotUrls
  dimensionsMm: BoxDimensionsMm
  bodyStripUrl?: string
  production?: TuckBoxProductionParams
  structure?: BoxDielineStructure
}): Promise<{ pdfUrl: string; fileName: string; resolutionDpi?: number }> {
  const { userId, slotUrls, dimensionsMm, bodyStripUrl, production, structure } = input
  const slotBuffers: Partial<Record<BoxFaceSlot, Buffer>> = {}
  await Promise.all(
    BOX_FACE_SLOT_ORDER.map(async (slot) => {
      const url = slotUrls[slot]
      if (!url) return
      const raw = await fetchImageBuffer(url)
      const [widthMm, heightMm] = getBoxFaceSlotDimensionsMm(slot, dimensionsMm)
      slotBuffers[slot] = await normalizePanelArtworkToPrintSize(raw, widthMm, heightMm)
    })
  )
  const bodyStripBuffer =
    bodyStripUrl && structure !== 'cross_fold'
      ? await normalizePanelArtworkToPrintSize(
          await fetchImageBuffer(bodyStripUrl),
          getBodyStripSizeMm(dimensionsMm).widthMm,
          getBodyStripSizeMm(dimensionsMm).heightMm
        )
      : undefined
  const resolutionInputs: { buffer: Buffer; widthMm: number; heightMm: number }[] = []
  if (bodyStripBuffer) {
    resolutionInputs.push({
      buffer: bodyStripBuffer,
      widthMm: 2 * (dimensionsMm.length + dimensionsMm.width),
      heightMm: dimensionsMm.height,
    })
  }
  for (const slot of BOX_FACE_SLOT_ORDER) {
    if (bodyStripBuffer && ['front', 'right', 'back', 'left'].includes(slot)) continue
    const buffer = slotBuffers[slot]
    if (!buffer) continue
    const [widthMm, heightMm] = getBoxFaceSlotDimensionsMm(slot, dimensionsMm)
    resolutionInputs.push({ buffer, widthMm, heightMm })
  }
  const dpis = await Promise.all(
    resolutionInputs.map(async ({ buffer, widthMm, heightMm }) => {
      const metadata = await sharp(buffer).metadata()
      if (!metadata.width || !metadata.height) return Number.POSITIVE_INFINITY
      return Math.min(
        (metadata.width * 25.4) / widthMm,
        (metadata.height * 25.4) / heightMm
      )
    })
  )
  const minDpi = Math.min(...dpis)
  const resolutionDpi = Number.isFinite(minDpi) ? Math.round(minDpi) : undefined
  const pdfBuffer = await createBoxDielinePdf({
    slotBuffers,
    bodyStripBuffer,
    boxLength: dimensionsMm.length,
    boxWidth: dimensionsMm.width,
    boxHeight: dimensionsMm.height,
    production,
    structure,
  })
  const stamp = Date.now()
  const structureSlug = structure ? boxDielineStructureSlug(structure) : 'default'
  const fileName = `box-dieline-${structureSlug}-${dimensionsMm.length}x${dimensionsMm.width}x${dimensionsMm.height}mm.pdf`
  const path = `results/${userId}/box_dieline_${structureSlug}_${stamp}.pdf`
  const { publicUrl } = await uploadTryOnImagePublic(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  return { pdfUrl: publicUrl, fileName, resolutionDpi }
}

export type ExportedBoxDielineVariant = {
  pdfUrl: string
  fileName: string
  resolutionDpi?: number
}

export async function exportAllBoxDielineVariants(input: {
  userId: string
  slotUrls: DielineSlotUrls
  dimensionsMm: BoxDimensionsMm
  bodyStripUrl?: string
  production?: TuckBoxProductionParams
}): Promise<Partial<Record<BoxDielineStructure, ExportedBoxDielineVariant>>> {
  const entries = await Promise.all(
    BOX_DIELINE_STRUCTURE_KEYS.map(async (structure) => {
      const exported = await exportBoxDielineFromUrls({ ...input, structure })
      return [structure, exported] as const
    })
  )
  return Object.fromEntries(entries) as Partial<Record<BoxDielineStructure, ExportedBoxDielineVariant>>
}
