import sharp from 'sharp'

export type CoverFrameHolePct = { x: number; y: number; w: number; h: number }

const CLEAR_ALPHA = 28
const MIN_HOLE_PCT = 18

function pct(n: number, size: number) {
  return Math.round((n / size) * 10000) / 100
}

/**
 * Sau khi xóa nền logo: lỗ giữa là vùng alpha thấp bao quanh tâm ảnh.
 * Trả về phần trăm để FrameCoverCard đặt ảnh cặp đôi.
 */
export async function measureCoverFrameHole(png: Buffer): Promise<CoverFrameHolePct | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  if (channels < 4 || width < 8 || height < 8) return null
  const clear = (x: number, y: number) => data[(y * width + x) * 4 + 3] <= CLEAR_ALPHA
  const cx = Math.floor(width / 2)
  const cy = Math.floor(height / 2)
  if (!clear(cx, cy)) return null

  let left = cx
  let right = cx
  let top = cy
  let bottom = cy
  while (left > 0 && clear(left - 1, cy)) left -= 1
  while (right < width - 1 && clear(right + 1, cy)) right += 1
  while (top > 0 && clear(cx, top - 1)) top -= 1
  while (bottom < height - 1 && clear(cx, bottom + 1)) bottom += 1

  const rowClear = (y: number, x0: number, x1: number) => {
    const step = Math.max(1, Math.floor((x1 - x0) / 80))
    let n = 0
    let ok = 0
    for (let x = x0; x <= x1; x += step) {
      n += 1
      if (clear(x, y)) ok += 1
    }
    return n > 0 && ok / n >= 0.82
  }
  const colClear = (x: number, y0: number, y1: number) => {
    const step = Math.max(1, Math.floor((y1 - y0) / 80))
    let n = 0
    let ok = 0
    for (let y = y0; y <= y1; y += step) {
      n += 1
      if (clear(x, y)) ok += 1
    }
    return n > 0 && ok / n >= 0.82
  }

  while (top < bottom && !rowClear(top, left, right)) top += 1
  while (bottom > top && !rowClear(bottom, left, right)) bottom -= 1
  while (left < right && !colClear(left, top, bottom)) left += 1
  while (right > left && !colClear(right, top, bottom)) right -= 1

  const hole = {
    x: pct(left, width),
    y: pct(top, height),
    w: pct(right - left + 1, width),
    h: pct(bottom - top + 1, height),
  }
  if (hole.w < MIN_HOLE_PCT || hole.h < MIN_HOLE_PCT) return null
  if (hole.x + hole.w > 100.5 || hole.y + hole.h > 100.5) return null
  return hole
}
