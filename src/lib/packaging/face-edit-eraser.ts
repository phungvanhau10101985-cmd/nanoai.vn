export function loadImageToCanvas(imageUrl: string): Promise<HTMLCanvasElement> {
  return loadImageToCanvasInternal(imageUrl).then(ensureCanvasReadable)
}

function loadImageToCanvasInternal(imageUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, img.naturalWidth)
      canvas.height = Math.max(1, img.naturalHeight)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('load image failed'))
    img.src = imageUrl
  })
}

async function ensureCanvasReadable(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas
    ctx.getImageData(0, 0, 1, 1)
    return canvas
  } catch {
    const blob = await canvasToBlob(canvas)
    const url = URL.createObjectURL(blob)
    try {
      return await loadImageToCanvasInternal(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export function eraseStrokeOnCanvas(
  canvas: HTMLCanvasElement,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radiusPx: number
): void {
  paintRoundStrokeOnCanvas(canvas, from, to, radiusPx, 'destination-out', 'rgba(0,0,0,1)')
}

export function paintStrokeOnMask(
  canvas: HTMLCanvasElement,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radiusPx: number
): void {
  paintRoundStrokeOnCanvas(canvas, from, to, radiusPx, 'source-over', '#ffffff')
}

export function paintRectOnMask(
  canvas: HTMLCanvasElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const w = Math.abs(x2 - x1)
  const h = Math.abs(y2 - y1)
  if (w < 1 || h < 1) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
}

function paintRoundStrokeOnCanvas(
  canvas: HTMLCanvasElement,
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  radiusPx: number,
  composite: GlobalCompositeOperation,
  color: string
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const r = Math.max(1, radiusPx)
  ctx.save()
  ctx.globalCompositeOperation = composite
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = r * 2
  if (from) {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(to.x, to.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function createMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  clearMaskCanvas(canvas)
  return canvas
}

export function clearMaskCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(source, 0, 0)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'))
        return
      }
      resolve(blob)
    }, type)
  })
}

export function compositeMagicErasePreview(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  target: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number
): void {
  target.width = Math.max(1, Math.round(displayWidth))
  target.height = Math.max(1, Math.round(displayHeight))
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(source, 0, 0, target.width, target.height)

  const tint = document.createElement('canvas')
  tint.width = target.width
  tint.height = target.height
  const tctx = tint.getContext('2d')
  if (!tctx) return
  tctx.drawImage(mask, 0, 0, target.width, target.height)
  tctx.globalCompositeOperation = 'source-in'
  tctx.fillStyle = 'rgba(236, 72, 153, 0.52)'
  tctx.fillRect(0, 0, tint.width, tint.height)
  ctx.drawImage(tint, 0, 0)
}

export function paintCanvasToDisplay(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number
): void {
  target.width = Math.max(1, Math.round(displayWidth))
  target.height = Math.max(1, Math.round(displayHeight))
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, target.width, target.height)
  ctx.drawImage(source, 0, 0, target.width, target.height)
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('toBlob failed'))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

export function snapshotCanvasPixels(canvas: HTMLCanvasElement): ImageData | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function restoreCanvasPixels(canvas: HTMLCanvasElement, data: ImageData): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.putImageData(data, 0, 0)
}

export function maskHasContent(mask: HTMLCanvasElement): boolean {
  const ctx = mask.getContext('2d')
  if (!ctx) return false
  const { data } = ctx.getImageData(0, 0, mask.width, mask.height)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! > 8 || data[i + 1]! > 8 || data[i + 2]! > 8) return true
  }
  return false
}
