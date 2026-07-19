import sharp from 'sharp'
import { ensureImageWithinLimits } from '@/lib/ensure-image-limits'

export const PANEL_PRINT_DPI = 300
export const DEFAULT_PANEL_BLEED_MM = 3
/** Stay below Sharp default input limit (~268MP) with headroom for composite layers. */
export const SHARP_SAFE_CANVAS_PIXELS = 180_000_000
export const MIN_DIELINE_RASTER_DPI = 96

export function mmToPrintPx(mm: number, dpi = PANEL_PRINT_DPI): number {
  return Math.max(1, Math.round((mm * dpi) / 25.4))
}

/** Pick raster DPI so the full dieline net canvas stays within Sharp limits. */
export function resolveDielineRasterDpi(
  contentWidthMm: number,
  contentHeightMm: number,
  preferredDpi = PANEL_PRINT_DPI
): number {
  let dpi = preferredDpi
  while (dpi > MIN_DIELINE_RASTER_DPI) {
    const w = mmToPrintPx(contentWidthMm, dpi)
    const h = mmToPrintPx(contentHeightMm, dpi)
    if (w * h <= SHARP_SAFE_CANVAS_PIXELS) return dpi
    const scale = Math.sqrt(SHARP_SAFE_CANVAS_PIXELS / (w * h)) * 0.98
    dpi = Math.max(MIN_DIELINE_RASTER_DPI, Math.floor(dpi * scale))
  }
  return MIN_DIELINE_RASTER_DPI
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
  const safeBuffer = await ensureImageWithinLimits(buffer)
  return sharp(safeBuffer, { limitInputPixels: false })
    .resize(widthPx, heightPx, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
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
  return sharp(trimBuffer, { limitInputPixels: false })
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
