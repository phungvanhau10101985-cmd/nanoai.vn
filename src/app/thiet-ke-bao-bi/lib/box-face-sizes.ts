/** Kích thước mặt hộp: L×W, L×H, W×H. Mỗi size tối đa 2 ảnh, tổng tối đa 6. */
export type FaceSizeKey = 'LxW' | 'LxH' | 'WxH'

export const FACE_SIZE_KEYS: FaceSizeKey[] = ['LxW', 'LxH', 'WxH']

export const CM_TO_MM = 10

export const BOX_DIM_MIN_CM = 2
export const BOX_DIM_MAX_CM = 50
export const BAG_DIM_MIN_CM = 2
export const BAG_DIM_MAX_CM = 50
export const BAG_GUSSET_MIN_CM = 1
export const BAG_GUSSET_MAX_CM = 20

export const DEFAULT_BOX_CM = { length: 20, width: 15, height: 10 }
export const DEFAULT_BAG_CM = { width: 20, height: 28, gusset: 6 }

export function cmToMm(cm: number): number {
  return Math.round(cm * CM_TO_MM)
}

/** Draft/project cũ lưu mm: chưa có dimensionsUnit → chia 10 sang cm. */
export function migrateStoredDim(value: number | undefined, fallbackCm: number, storedInCm: boolean): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return fallbackCm
  return storedInCm ? value : Math.round(value / CM_TO_MM)
}

export function clampBoxCm(n: number): number {
  return Math.max(BOX_DIM_MIN_CM, Math.min(BOX_DIM_MAX_CM, Math.round(n) || BOX_DIM_MIN_CM))
}

export function clampBagCm(n: number): number {
  return Math.max(BAG_DIM_MIN_CM, Math.min(BAG_DIM_MAX_CM, Math.round(n) || BAG_DIM_MIN_CM))
}

export function clampBagGussetCm(n: number): number {
  return Math.max(BAG_GUSSET_MIN_CM, Math.min(BAG_GUSSET_MAX_CM, Math.round(n) || BAG_GUSSET_MIN_CM))
}

export function getDimensionsFromSizeKey(
  sizeKey: FaceSizeKey,
  boxLength: number,
  boxWidth: number,
  boxHeight: number
): [number, number] {
  switch (sizeKey) {
    case 'LxW':
      return [boxLength, boxWidth]
    case 'LxH':
      return [boxLength, boxHeight]
    case 'WxH':
      return [boxWidth, boxHeight]
    default:
      return [boxLength, boxWidth]
  }
}

export function getSizeKeyLabel(sizeKey: FaceSizeKey, L: number, W: number, H: number): string {
  switch (sizeKey) {
    case 'LxW':
      return `L×W (${L}×${W} cm)`
    case 'LxH':
      return `L×H (${L}×${H} cm)`
    case 'WxH':
      return `W×H (${W}×${H} cm)`
    default:
      return sizeKey
  }
}
