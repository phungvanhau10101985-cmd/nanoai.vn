/**
 * Render tem niêm phong / bảo hành / hàng chính hãng lên canvas.
 */

export type SealType = 'niem-phong' | 'bao-hanh' | 'chinh-hang'

const DEFAULT_TEXTS: Record<SealType, string> = {
  'niem-phong': 'TEM NIÊM PHONG',
  'bao-hanh': 'BẢO HÀNH',
  'chinh-hang': 'HÀNG CHÍNH HÃNG',
}

export interface SealOptions {
  type: SealType
  mainText: string
  companyName: string
  validityDate: string
  serialNumber: string
  widthPx: number
  heightPx: number
}

export function drawSealLabel(ctx: CanvasRenderingContext2D, opts: SealOptions): void {
  const { type, mainText, companyName, validityDate, serialNumber, widthPx, heightPx } = opts
  const w = widthPx
  const h = heightPx
  const pad = Math.min(w, h) * 0.08

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)

  if (type === 'chinh-hang') {
    ctx.strokeStyle = '#15803d'
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)'
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)
  } else {
    ctx.strokeStyle = '#b91c1c'
  }
  ctx.lineWidth = Math.max(2, w * 0.015)
  ctx.setLineDash(type === 'niem-phong' ? [8, 4] : [])
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)

  if (type === 'niem-phong') {
    ctx.strokeRect(pad + 4, pad + 4, w - pad * 2 - 8, h - pad * 2 - 8)
  }

  ctx.fillStyle = type === 'chinh-hang' ? '#15803d' : '#1e293b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const centerX = w / 2
  let y = pad + (h - pad * 2) * 0.25

  ctx.font = `bold ${Math.min(w * 0.18, h * 0.2)}px sans-serif`
  ctx.fillText(mainText || DEFAULT_TEXTS[type], centerX, y)

  y += (h - pad * 2) * 0.2
  if (companyName) {
    ctx.font = `${Math.min(w * 0.08, h * 0.09)}px sans-serif`
    ctx.fillText(companyName, centerX, y)
    y += (h - pad * 2) * 0.15
  }

  if (type === 'bao-hanh' && validityDate) {
    ctx.font = `${Math.min(w * 0.07, h * 0.08)}px sans-serif`
    ctx.fillText(`Hạn: ${validityDate}`, centerX, y)
    y += (h - pad * 2) * 0.12
  }

  if (serialNumber) {
    ctx.font = `${Math.min(w * 0.06, h * 0.07)}px monospace`
    ctx.fillStyle = '#64748b'
    ctx.fillText(`Số: ${serialNumber}`, centerX, h - pad - (h - pad * 2) * 0.15)
  }
}

export function renderSealToDataUrl(opts: SealOptions): string {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return ''
  canvas.width = opts.widthPx
  canvas.height = opts.heightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  drawSealLabel(ctx, opts)
  return canvas.toDataURL('image/png')
}
