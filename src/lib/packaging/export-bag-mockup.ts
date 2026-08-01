import { renderBagMockupPng } from '@/lib/packaging/render-bag-mockup'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import type { BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'

export async function exportBagMockupFromFaces(input: {
  userId: string
  faceSlots: Partial<
    Record<BagFaceSlot, { sourceMode: string; url?: string }>
  >
  dimensionsMm: BagDimensionsMm
}): Promise<{ pngUrl: string; fileName: string }> {
  const pngBuffer = await renderBagMockupPng({
    faceSlots: input.faceSlots,
    bag: input.dimensionsMm,
  })
  const stamp = Date.now()
  const { width, height, gusset } = input.dimensionsMm
  const fileName = `bag-mockup-${width}x${height}x${gusset}mm.png`
  const path = `results/${input.userId}/bag_mockup_${stamp}.png`
  const { publicUrl } = await uploadTryOnImagePublic(path, pngBuffer, {
    contentType: 'image/png',
    upsert: true,
  })
  return { pngUrl: publicUrl, fileName }
}
