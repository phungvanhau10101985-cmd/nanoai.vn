import jsQR from 'jsqr'
import { parseAnswerCardPayload } from '@/lib/lop/answer-card'

export type DetectedAnswerCard = {
  token: string
  topLeft: { x: number; y: number }
  topRight: { x: number; y: number }
  bottomRight: { x: number; y: number }
  bottomLeft: { x: number; y: number }
}

function blankQr(data: Uint8ClampedArray, width: number, height: number, corners: Array<{ x: number; y: number }>) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (const corner of corners) {
    minX = Math.min(minX, corner.x)
    minY = Math.min(minY, corner.y)
    maxX = Math.max(maxX, corner.x)
    maxY = Math.max(maxY, corner.y)
  }
  const pad = 10
  const x0 = Math.max(0, Math.floor(minX) - pad)
  const y0 = Math.max(0, Math.floor(minY) - pad)
  const x1 = Math.min(width - 1, Math.ceil(maxX) + pad)
  const y1 = Math.min(height - 1, Math.ceil(maxY) + pad)
  for (let y = y0; y <= y1; y += 1) {
    const row = y * width * 4
    for (let x = x0; x <= x1; x += 1) {
      const i = row + x * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
}

/** jsQR đọc một mã mỗi lần. Xóa vùng đã đọc rồi quét tiếp để bắt nhiều thẻ trong một khung. */
export function detectAnswerCards(image: ImageData, maxCards = 16): DetectedAnswerCard[] {
  const data = new Uint8ClampedArray(image.data)
  const found: DetectedAnswerCard[] = []
  const seen = new Set<string>()
  for (let n = 0; n < maxCards; n += 1) {
    const code = jsQR(data, image.width, image.height, { inversionAttempts: 'dontInvert' })
    if (!code) break
    const token = parseAnswerCardPayload(code.data)
    if (token && !seen.has(token)) {
      seen.add(token)
      found.push({
        token,
        topLeft: { x: code.location.topLeftCorner.x, y: code.location.topLeftCorner.y },
        topRight: { x: code.location.topRightCorner.x, y: code.location.topRightCorner.y },
        bottomRight: { x: code.location.bottomRightCorner.x, y: code.location.bottomRightCorner.y },
        bottomLeft: { x: code.location.bottomLeftCorner.x, y: code.location.bottomLeftCorner.y },
      })
    }
    blankQr(data, image.width, image.height, [
      code.location.topLeftCorner,
      code.location.topRightCorner,
      code.location.bottomRightCorner,
      code.location.bottomLeftCorner,
    ])
  }
  return found
}
