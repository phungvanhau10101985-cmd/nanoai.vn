import type { CoverFrameHolePct } from './measure-cover-frame-hole'

const CLEAR_ALPHA = 28

export type CoverFrameHoleMask = {
  rgba: Uint8ClampedArray
  box: CoverFrameHolePct
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function dilate(src: Uint8Array, width: number, height: number, radius: number) {
  if (radius <= 0) return src
  const mid = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      let on = 0
      for (let xx = x0; xx <= x1; xx += 1) {
        if (src[row + xx]) {
          on = 1
          break
        }
      }
      mid[row + x] = on
    }
  }
  const out = new Uint8Array(width * height)
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(height - 1, y + radius)
      let on = 0
      for (let yy = y0; yy <= y1; yy += 1) {
        if (mid[yy * width + x]) {
          on = 1
          break
        }
      }
      out[y * width + x] = on
    }
  }
  return out
}

function findSeed(wall: Uint8Array, width: number, height: number, sx: number, sy: number) {
  if (!wall[sy * width + sx]) return { x: sx, y: sy }
  for (let radius = 1; radius <= 12; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = sx + dx
        const y = sy + dy
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        if (!wall[y * width + x]) return { x, y }
      }
    }
  }
  return null
}

function flood(wall: Uint8Array, width: number, height: number, sx: number, sy: number) {
  const seen = new Uint8Array(width * height)
  const qx = new Int32Array(width * height)
  const qy = new Int32Array(width * height)
  let head = 0
  let tail = 1
  seen[sy * width + sx] = 1
  qx[0] = sx
  qy[0] = sy
  while (head < tail) {
    const x = qx[head]
    const y = qy[head]
    head += 1
    const push = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
      const index = ny * width + nx
      if (seen[index] || wall[index]) return
      seen[index] = 1
      qx[tail] = nx
      qy[tail] = ny
      tail += 1
    }
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
  return seen
}

function touchesBorder(fill: Uint8Array, width: number, height: number) {
  for (let x = 0; x < width; x += 1) {
    if (fill[x] || fill[(height - 1) * width + x]) return true
  }
  for (let y = 0; y < height; y += 1) {
    if (fill[y * width] || fill[y * width + width - 1]) return true
  }
  return false
}

function countOn(fill: Uint8Array) {
  let count = 0
  for (let i = 0; i < fill.length; i += 1) count += fill[i]
  return count
}

function enclosedFill(wall: Uint8Array, width: number, height: number, sx: number, sy: number) {
  const seed = findSeed(wall, width, height, sx, sy)
  if (!seed) return null
  const fill = flood(wall, width, height, seed.x, seed.y)
  if (touchesBorder(fill, width, height)) return null
  const pct = (countOn(fill) / (width * height)) * 100
  if (pct < 8 || pct > 70) return null
  return fill
}

function boxOf(fill: Uint8Array, width: number, height: number): CoverFrameHolePct {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!fill[y * width + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const pct = (n: number, size: number) => Math.round((n / size) * 10000) / 100
  return {
    x: pct(minX, width),
    y: pct(minY, height),
    w: pct(maxX - minX + 1, width),
    h: pct(maxY - minY + 1, height),
  }
}

/** Vùng có nét vẽ của khung. Nền trong suốt ngoài vòng hoa không tính. Khung đầy khung trả về null. */
export function measureCoverFrameContentBox(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): CoverFrameHolePct | null {
  if (width < 8 || height < 8 || rgba.length < width * height * 4) return null
  const count = width * height
  const wall = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    if (rgba[i * 4 + 3] > CLEAR_ALPHA) wall[i] = 1
  }
  if (countOn(wall) < count * 0.02) return null
  const raw = boxOf(wall, width, height)
  const pad = 1.2
  const x = Math.max(0, Math.round((raw.x - pad) * 100) / 100)
  const y = Math.max(0, Math.round((raw.y - pad) * 100) / 100)
  const w = Math.min(100 - x, Math.round((raw.w + pad * 2) * 100) / 100)
  const h = Math.min(100 - y, Math.round((raw.h + pad * 2) * 100) / 100)
  if (w > 96 && h > 96) return null
  return { x, y, w, h }
}

/**
 * Lỗ thật của khung là vùng trong suốt bị viền bao kín (tròn, oval, chữ nhật).
 * Không lấy hình chữ nhật nội tiếp — góc của hình đó nằm ngoài vòng hoa.
 */
export function buildCoverFrameHoleMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  seed?: { x: number; y: number },
): CoverFrameHoleMask | null {
  if (width < 8 || height < 8 || rgba.length < width * height * 4) return null
  const count = width * height
  const wall = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    if (rgba[i * 4 + 3] > CLEAR_ALPHA) wall[i] = 1
  }
  const sx = clampInt(seed?.x ?? width / 2, 0, width - 1)
  const sy = clampInt(seed?.y ?? height / 2, 0, height - 1)

  let fill = enclosedFill(wall, width, height, sx, sy)
  let seal = 0
  if (!fill) {
    for (const radius of [2, 5]) {
      const sealed = dilate(wall, width, height, radius)
      const next = enclosedFill(sealed, width, height, sx, sy)
      if (!next) continue
      fill = next
      seal = radius
      break
    }
  }
  if (!fill) return null

  const tuck = Math.max(1, Math.round(Math.min(width, height) * 0.008))
  let grown = dilate(fill, width, height, seal + tuck)
  if (touchesBorder(grown, width, height) || (countOn(grown) / count) * 100 > 78) {
    grown = dilate(fill, width, height, seal)
  }
  if (touchesBorder(grown, width, height) || (countOn(grown) / count) * 100 > 78) grown = fill
  if (touchesBorder(grown, width, height)) return null

  const out = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i += 1) {
    if (!grown[i]) continue
    const offset = i * 4
    out[offset] = 255
    out[offset + 1] = 255
    out[offset + 2] = 255
    out[offset + 3] = 255
  }
  return { rgba: out, box: boxOf(grown, width, height) }
}
