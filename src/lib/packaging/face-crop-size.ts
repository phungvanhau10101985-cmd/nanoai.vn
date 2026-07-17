import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'
import { getFaceDimensionsMm, type PackagingFaceKey } from '@/lib/packaging/dimensions'

export type FaceSizeMm = { widthMm: number; heightMm: number }

/** Accept `{ width, height }` or `{ widthMm, heightMm }` from stored studio payloads. */
export function normalizeFaceSizeMm(raw: unknown): FaceSizeMm | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const widthMm = Number(o.widthMm ?? o.width)
  const heightMm = Number(o.heightMm ?? o.height)
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return null
  }
  return { widthMm, heightMm }
}

export function isValidFaceSizeMm(raw: unknown): raw is FaceSizeMm {
  return normalizeFaceSizeMm(raw) != null
}

export function getFaceSizeMmForPackagingFaceKey(
  dimensionsMm: BoxDimensionsMm,
  faceKey: PackagingFaceKey
): FaceSizeMm {
  const [widthMm, heightMm] = getFaceDimensionsMm(faceKey, dimensionsMm)
  return { widthMm, heightMm }
}

/** Map crop region (image pixels) to physical mm on the box face. */
export function cropRegionToPrintSizeMm(
  faceSize: FaceSizeMm,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  crop: { x: number; y: number; width: number; height: number }
): FaceSizeMm {
  if (imageNaturalWidth <= 0 || imageNaturalHeight <= 0) return faceSize
  const aspect = faceSize.widthMm / faceSize.heightMm
  const containW = Math.max(imageNaturalWidth, imageNaturalHeight * aspect)
  const containH = containW / aspect
  const widthMm = (faceSize.widthMm * crop.width) / containW
  const heightMm = (faceSize.heightMm * crop.height) / containH
  return {
    widthMm: Math.round(widthMm * 100) / 100,
    heightMm: Math.round(heightMm * 100) / 100,
  }
}

export function formatMmSize(locale: WebLocale, widthMm: number, heightMm: number): string {
  const w = Number(widthMm)
  const h = Number(heightMm)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return '—'
  const wCm = (w / 10).toFixed(1)
  const hCm = (h / 10).toFixed(1)
  const wMm = w.toFixed(w % 1 === 0 ? 0 : 1)
  const hMm = h.toFixed(h % 1 === 0 ? 0 : 1)
  if (locale === 'vi') {
    return `${wMm.replace('.', ',')} × ${hMm.replace('.', ',')} mm (${wCm.replace('.', ',')} × ${hCm.replace('.', ',')} cm)`
  }
  return `${wMm} × ${hMm} mm (${wCm} × ${hCm} cm)`
}
