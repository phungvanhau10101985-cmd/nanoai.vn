import { createBoxDielinePdf } from '@/app/thiet-ke-bao-bi/lib/box-dieline-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { BOX_FACE_SLOT_ORDER, type BoxFaceSlot } from '@/lib/packaging/box-face-slots'

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
}): Promise<{ pdfUrl: string; fileName: string }> {
  const { userId, slotUrls, dimensionsMm } = input
  const slotBuffers: Partial<Record<BoxFaceSlot, Buffer>> = {}
  await Promise.all(
    BOX_FACE_SLOT_ORDER.map(async (slot) => {
      const url = slotUrls[slot]
      if (!url) return
      slotBuffers[slot] = await fetchImageBuffer(url)
    })
  )
  const pdfBuffer = await createBoxDielinePdf({
    slotBuffers,
    boxLength: dimensionsMm.length,
    boxWidth: dimensionsMm.width,
    boxHeight: dimensionsMm.height,
  })
  const stamp = Date.now()
  const fileName = `box-dieline-${dimensionsMm.length}x${dimensionsMm.width}x${dimensionsMm.height}mm.pdf`
  const path = `results/${userId}/box_dieline_${stamp}.pdf`
  const { publicUrl } = await uploadTryOnImagePublic(path, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  return { pdfUrl: publicUrl, fileName }
}
