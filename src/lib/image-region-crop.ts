/** Vùng cắt chuẩn hóa theo ảnh gốc: (0,0) góc trên-trái, (1,1) góc dưới-phải. */
export type NormRect = { x: number; y: number; w: number; h: number }

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'draw'

/** Khung mặc định hơi thụt vào để người dùng thấy đây là vùng sẽ gửi, không phải cả ảnh. */
export const DEFAULT_CROP_RECT: NormRect = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 }

export const FULL_IMAGE_RECT: NormRect = { x: 0, y: 0, w: 1, h: 1 }

export const MIN_CROP_NORM = 0.06

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

export function clampNormRect(rect: NormRect, min = MIN_CROP_NORM): NormRect {
  const w = clamp(rect.w, min, 1)
  const h = clamp(rect.h, min, 1)
  return {
    x: clamp(rect.x, 0, 1 - w),
    y: clamp(rect.y, 0, 1 - h),
    w,
    h,
  }
}

export function coversFullImage(rect: NormRect, slack = 0.01): boolean {
  return rect.x <= slack && rect.y <= slack && rect.x + rect.w >= 1 - slack && rect.y + rect.h >= 1 - slack
}

export function normRectFromDrag(x0: number, y0: number, x1: number, y1: number, min = MIN_CROP_NORM): NormRect {
  return clampNormRect(
    {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
    },
    min,
  )
}

export function resizeNormRect(
  start: NormRect,
  handle: Exclude<CropHandle, 'draw'>,
  dx: number,
  dy: number,
  min = MIN_CROP_NORM,
): NormRect {
  if (handle === 'move') {
    return clampNormRect({ x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }, min)
  }

  const right = start.x + start.w
  const bottom = start.y + start.h
  let x = start.x
  let y = start.y
  let w = start.w
  let h = start.h

  if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    x = Math.min(Math.max(0, start.x + dx), right - min)
    w = right - x
  }
  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    w = Math.min(Math.max(min, start.w + dx), 1 - start.x)
  }
  if (handle === 'n' || handle === 'nw' || handle === 'ne') {
    y = Math.min(Math.max(0, start.y + dy), bottom - min)
    h = bottom - y
  }
  if (handle === 's' || handle === 'sw' || handle === 'se') {
    h = Math.min(Math.max(min, start.h + dy), 1 - start.y)
  }

  return clampNormRect({ x, y, w, h }, min)
}

export function hitCropHandle(rect: NormRect, nx: number, ny: number, handleNorm: number): CropHandle | null {
  const { x, y, w, h } = rect
  const nearL = Math.abs(nx - x) <= handleNorm
  const nearR = Math.abs(nx - (x + w)) <= handleNorm
  const nearT = Math.abs(ny - y) <= handleNorm
  const nearB = Math.abs(ny - (y + h)) <= handleNorm
  const inX = nx >= x - handleNorm && nx <= x + w + handleNorm
  const inY = ny >= y - handleNorm && ny <= y + h + handleNorm
  if (nearT && nearL) return 'nw'
  if (nearT && nearR) return 'ne'
  if (nearB && nearL) return 'sw'
  if (nearB && nearR) return 'se'
  if (nearT && inX) return 'n'
  if (nearB && inX) return 's'
  if (nearL && inY) return 'w'
  if (nearR && inY) return 'e'
  if (nx >= x && nx <= x + w && ny >= y && ny <= y + h) return 'move'
  return null
}

export function pixelCrop(
  rect: NormRect,
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const safeW = Math.max(1, Math.round(width))
  const safeH = Math.max(1, Math.round(height))
  const sx = clamp(Math.round(rect.x * safeW), 0, safeW - 1)
  const sy = clamp(Math.round(rect.y * safeH), 0, safeH - 1)
  const sw = clamp(Math.round(rect.w * safeW), 1, safeW - sx)
  const sh = clamp(Math.round(rect.h * safeH), 1, safeH - sy)
  return { sx, sy, sw, sh }
}

type BitmapSource = {
  width: number
  height: number
  image: CanvasImageSource
  close: () => void
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

async function loadBitmap(file: File): Promise<BitmapSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return {
        width: bmp.width,
        height: bmp.height,
        image: bmp,
        close: () => bmp.close(),
      }
    } catch {
      // Một số ảnh camera không giải mã được bằng createImageBitmap.
    }
  }
  const img = await loadHtmlImage(file)
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    image: img,
    close: () => {},
  }
}

/** Cắt file ảnh theo vùng. Vùng gần kín ảnh thì giữ file gốc. Trả null khi không cắt được. */
export async function cropImageFile(file: File, rect: NormRect): Promise<File | null> {
  if (typeof document === 'undefined') return null
  if (coversFullImage(rect)) return file
  try {
    const source = await loadBitmap(file)
    try {
      if (source.width < 2 || source.height < 2) return null
      const { sx, sy, sw, sh } = pixelCrop(rect, source.width, source.height)
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(source.image, sx, sy, sw, sh, 0, 0, sw, sh)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92)
      })
      if (!blob || blob.size === 0) return null
      const base = file.name.replace(/\.[^.]+$/, '').trim() || 'homework'
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    } finally {
      source.close()
    }
  } catch {
    return null
  }
}
