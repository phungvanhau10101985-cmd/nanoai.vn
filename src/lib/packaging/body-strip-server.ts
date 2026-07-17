import sharp from 'sharp'
import type { BoxDimensionsMm } from './dimensions'
import type { BoxFaceSlot } from './box-face-slots'
import { getBodyStripSegments, getBodyStripSizeMm } from './body-strip'

export async function splitBodyStripBuffer(
  buffer: Buffer,
  dimensions: BoxDimensionsMm
): Promise<Partial<Record<BoxFaceSlot, Buffer>>> {
  const metadata = await sharp(buffer).metadata()
  const sourceWidth = metadata.width ?? 0
  const sourceHeight = metadata.height ?? 0
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('Invalid body strip image.')

  const totalMm = getBodyStripSizeMm(dimensions).widthMm
  const result: Partial<Record<BoxFaceSlot, Buffer>> = {}
  const segments = getBodyStripSegments(dimensions)
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!
    const left = Math.round((segment.offsetMm / totalMm) * sourceWidth)
    const right =
      index === segments.length - 1
        ? sourceWidth
        : Math.round(((segment.offsetMm + segment.widthMm) / totalMm) * sourceWidth)
    result[segment.slot] = await sharp(buffer)
      .extract({ left, top: 0, width: Math.max(1, right - left), height: sourceHeight })
      .png()
      .toBuffer()
  }
  return result
}
