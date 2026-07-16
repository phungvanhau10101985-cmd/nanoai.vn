import { renderBoxMockupPng } from '@/lib/packaging/render-box-mockup'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import type { BoxCreatedFace, BoxFaceSlot, FaceSourceMode } from '@/lib/packaging/box-face-slots'

export async function exportBoxMockupFromFaces(input: {
  userId: string
  faces: Pick<BoxCreatedFace, 'slot' | 'url' | 'sourceMode'>[]
  faceSlots?: Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>
  dimensionsMm: BoxDimensionsMm
}): Promise<{ pngUrl: string; fileName: string }> {
  const pngBuffer = await renderBoxMockupPng({
    faces: input.faces,
    faceSlots: input.faceSlots,
    box: input.dimensionsMm,
  })
  const stamp = Date.now()
  const fileName = `box-mockup-${input.dimensionsMm.length}x${input.dimensionsMm.width}x${input.dimensionsMm.height}mm.png`
  const path = `results/${input.userId}/box_mockup_${stamp}.png`
  const { publicUrl } = await uploadTryOnImagePublic(path, pngBuffer, {
    contentType: 'image/png',
    upsert: true,
  })
  return { pngUrl: publicUrl, fileName }
}
