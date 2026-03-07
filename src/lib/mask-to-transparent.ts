/**
 * Áp mask lên ảnh gốc để tạo PNG nền trong suốt.
 * Dùng Sharp (Node.js) – không cần Python/Pillow, chạy được trên mọi môi trường.
 */
import sharp from 'sharp'

export async function buildTransparentPngFromMask(
  originalBuffer: Buffer,
  maskBuffer: Buffer
): Promise<Buffer> {
  const img = sharp(originalBuffer)
  const meta = await img.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width <= 0 || height <= 0) {
    throw new Error('Không đọc được kích thước ảnh gốc.')
  }

  const maskProcessed = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .grayscale()
    .normalize()
    .blur(0.8)
    .toBuffer()

  return sharp(originalBuffer)
    .removeAlpha()
    .joinChannel(maskProcessed)
    .png()
    .toBuffer()
}
