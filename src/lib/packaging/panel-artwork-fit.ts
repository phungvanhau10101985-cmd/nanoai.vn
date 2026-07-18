import sharp from 'sharp'

export const PANEL_PRINT_DPI = 300
export const DEFAULT_PANEL_BLEED_MM = 3

export function mmToPrintPx(mm: number, dpi = PANEL_PRINT_DPI): number {
  return Math.max(1, Math.round((mm * dpi) / 25.4))
}

/** Resize artwork to exact trim panel size — edges align with dieline fold lines. */
export async function fitPanelArtworkToTrim(
  buffer: Buffer,
  widthMm: number,
  heightMm: number,
  dpi = PANEL_PRINT_DPI
): Promise<Buffer> {
  const widthPx = mmToPrintPx(widthMm, dpi)
  const heightPx = mmToPrintPx(heightMm, dpi)
  return sharp(buffer)
    .resize(widthPx, heightPx, { fit: 'fill' })
    .png()
    .toBuffer()
}

/** Extend trim artwork outward for print bleed by replicating edge pixels. */
export async function extendPanelArtworkBleed(
  trimBuffer: Buffer,
  bleedMm: number,
  dpi = PANEL_PRINT_DPI
): Promise<Buffer> {
  if (bleedMm <= 0) return trimBuffer
  const bleedPx = mmToPrintPx(bleedMm, dpi)
  return sharp(trimBuffer)
    .extend({
      top: bleedPx,
      bottom: bleedPx,
      left: bleedPx,
      right: bleedPx,
      extendWith: 'copy',
    })
    .png()
    .toBuffer()
}

export type PreparedPanelArtwork = {
  trimBuffer: Buffer
  bleedBuffer: Buffer
  trimWidthPx: number
  trimHeightPx: number
  bleedWidthPx: number
  bleedHeightPx: number
}

/** Fit artwork to trim mm, then build bleed layer for dieline composite. */
export async function preparePanelArtworkForDieline(
  buffer: Buffer,
  widthMm: number,
  heightMm: number,
  bleedMm = DEFAULT_PANEL_BLEED_MM,
  dpi = PANEL_PRINT_DPI
): Promise<PreparedPanelArtwork> {
  const trimWidthPx = mmToPrintPx(widthMm, dpi)
  const trimHeightPx = mmToPrintPx(heightMm, dpi)
  const bleedPx = mmToPrintPx(bleedMm, dpi)
  const trimBuffer = await fitPanelArtworkToTrim(buffer, widthMm, heightMm, dpi)
  const bleedBuffer = await extendPanelArtworkBleed(trimBuffer, bleedMm, dpi)
  const bleedWidthPx = trimWidthPx + bleedPx * 2
  const bleedHeightPx = trimHeightPx + bleedPx * 2
  return {
    trimBuffer,
    bleedBuffer,
    trimWidthPx,
    trimHeightPx,
    bleedWidthPx,
    bleedHeightPx,
  }
}

/** Normalize generated/uploaded face art to exact print trim pixels before storage. */
export async function normalizePanelArtworkToPrintSize(
  buffer: Buffer,
  widthMm: number,
  heightMm: number,
  dpi = PANEL_PRINT_DPI
): Promise<Buffer> {
  return fitPanelArtworkToTrim(buffer, widthMm, heightMm, dpi)
}
