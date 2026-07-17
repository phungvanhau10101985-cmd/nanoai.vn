import { createBoxDielinePdf } from '@/app/thiet-ke-bao-bi/lib/box-dieline-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { BOX_FACE_SLOT_ORDER, type BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { TuckBoxProductionParams } from './tuck-box-production'
import type { BoxDielineStructure } from './dieline-structure'
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
      slotBuffers[slot] = await fetchImageBuffer(url)
    })
  )
  const bodyStripBuffer =
    bodyStripUrl && structure !== 'cross_fold' ? await fetchImageBuffer(bodyStripUrl) : undefined
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
    const widthMm = slot === 'right' || slot === 'left' ? dimensionsMm.width : dimensionsMm.length
    const heightMm = slot === 'top' || slot === 'bottom' ? dimensionsMm.width : dimensionsMm.height
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
  const fileName = `box-dieline-${dimensionsMm.length}x${dimensionsMm.width}x${dimensionsMm.height}mm.pdf`
  const path = `results/${userId}/box_dieline_${stamp}.pdf`
  const { publicUrl } = await uploadTryOnImagePublic(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  return { pdfUrl: publicUrl, fileName, resolutionDpi }
}
