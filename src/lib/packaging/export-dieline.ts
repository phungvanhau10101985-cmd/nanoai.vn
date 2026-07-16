import { createBoxDielinePdf } from '@/app/thiet-ke-bao-bi/lib/box-dieline-pdf'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'

export type DielineFaceUrls = {
  LxW: string
  LxH: string
  WxH: string
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Không tải được ảnh mặt hộp (${response.status}).`)
  return Buffer.from(await response.arrayBuffer())
}

export async function exportBoxDielineFromUrls(input: {
  userId: string
  faces: DielineFaceUrls
  dimensionsMm: BoxDimensionsMm
}): Promise<{ pdfUrl: string; fileName: string }> {
  const { userId, faces, dimensionsMm } = input
  const [face1Buffer, face2Buffer, face3Buffer] = await Promise.all([
    fetchImageBuffer(faces.LxW),
    fetchImageBuffer(faces.LxH),
    fetchImageBuffer(faces.WxH),
  ])
  const pdfBuffer = await createBoxDielinePdf({
    face1Buffer,
    face2Buffer,
    face3Buffer,
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

