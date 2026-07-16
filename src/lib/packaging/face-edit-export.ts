export type FaceEditTextOverlay = {
  id: string
  kind: 'text'
  /** Normalized position within crop (0–1). */
  nx: number
  ny: number
  text: string
  /** Font size as fraction of crop height. */
  fontSizeRatio: number
  color: string
}

export type FaceEditImageOverlay = {
  id: string
  kind: 'image' | 'sticker'
  nx: number
  ny: number
  nw: number
  nh: number
  src: string
}

export type FaceEditOverlay = FaceEditTextOverlay | FaceEditImageOverlay

export type FaceEditCropRect = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('load image failed'))
    el.src = src
  })
}

export async function exportFaceEditBlob(
  imageUrl: string,
  crop: FaceEditCropRect,
  overlays: FaceEditOverlay[]
): Promise<Blob> {
  const base = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width))
  canvas.height = Math.max(1, Math.round(crop.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.drawImage(
    base,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  for (const layer of overlays) {
    if (layer.kind === 'text') {
      const fontPx = Math.max(8, Math.round(layer.fontSizeRatio * canvas.height))
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`
      ctx.fillStyle = layer.color
      ctx.textBaseline = 'top'
      ctx.fillText(layer.text, layer.nx * canvas.width, layer.ny * canvas.height)
      continue
    }
    const img = await loadImage(layer.src)
    ctx.drawImage(
      img,
      layer.nx * canvas.width,
      layer.ny * canvas.height,
      layer.nw * canvas.width,
      layer.nh * canvas.height
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
