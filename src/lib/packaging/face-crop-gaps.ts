import type { FaceSizeMm } from '@/lib/packaging/face-crop-size'
import type { FaceEditCropRect } from '@/lib/packaging/face-edit-export'

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y > 0) {
    const t = y
    y = x % y
    x = t
  }
  return Math.max(1, x)
}

export function cropHasGapExtensions(crop: FaceEditCropRect, imgW: number, imgH: number): boolean {
  if (imgW <= 0 || imgH <= 0) return false
  const tol = 0.5
  return (
    crop.x < -tol ||
    crop.y < -tol ||
    crop.x + crop.width > imgW + tol ||
    crop.y + crop.height > imgH + tol
  )
}

export function faceSizeAspectRatioLabel(faceSize: FaceSizeMm): string {
  const w = Math.max(1, Math.round(faceSize.widthMm))
  const h = Math.max(1, Math.round(faceSize.heightMm))
  const g = gcd(w, h)
  return `${w / g}:${h / g}`
}
