/**
 * Test tạo ảnh layout: 21:9 canvas + vùng 5:1 (500×100) bên trong
 * Chạy: node scripts/test-layout-image.mjs
 */

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CARTON_COLOR = { r: 196, g: 165, b: 116 }
const BASE_SIZE = 1024

function parseAspectRatioToDimensions(ar, baseSize) {
  const [w, h] = ar.split(':').map(Number)
  if (!w || !h) return [baseSize, baseSize]
  const ratio = w / h
  if (ratio >= 1) return [baseSize, Math.round(baseSize / ratio)]
  return [Math.round(baseSize * ratio), baseSize]
}

function getDesignRectInCanvas(canvasW, canvasH, surfaceLength, surfaceWidth) {
  const designRatio = surfaceLength / surfaceWidth
  let rectW, rectH
  if (designRatio >= canvasW / canvasH) {
    rectW = canvasW
    rectH = Math.round(canvasW / designRatio)
  } else {
    rectH = canvasH
    rectW = Math.round(canvasH * designRatio)
  }
  const x = Math.round((canvasW - rectW) / 2)
  const y = Math.round((canvasH - rectH) / 2)
  return { x, y, w: rectW, h: rectH }
}

async function main() {
  const aspectRatio = '21:9'
  const surfaceLength = 500
  const surfaceWidth = 100

  const [canvasW, canvasH] = parseAspectRatioToDimensions(aspectRatio, BASE_SIZE)
  const { x, y, w, h } = getDesignRectInCanvas(canvasW, canvasH, surfaceLength, surfaceWidth)

  console.log('Canvas 21:9:', canvasW, 'x', canvasH)
  console.log('Vùng design 5:1 (500×100):', w, 'x', h, 'at', x, y)

  const cartonRect = await sharp({
    create: { width: Math.max(1, w), height: Math.max(1, h), channels: 3, background: CARTON_COLOR },
  })
    .png()
    .toBuffer()

  const borderSvg = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="white" stroke-width="3"/></svg>`
  )

  const result = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: cartonRect, left: x, top: y },
      { input: borderSvg, left: x, top: y },
    ])
    .png()
    .toBuffer()

  const outPath = join(__dirname, '..', 'public', 'test-layout-21x9-5x1.png')
  writeFileSync(outPath, result)
  console.log('Đã lưu:', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
