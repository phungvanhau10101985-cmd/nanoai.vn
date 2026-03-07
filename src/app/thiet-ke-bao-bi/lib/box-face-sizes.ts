/** Kích thước mặt hộp: L×W, L×H, W×H. Mỗi size tối đa 2 ảnh, tổng tối đa 6. */
export type FaceSizeKey = 'LxW' | 'LxH' | 'WxH'

export const FACE_SIZE_KEYS: FaceSizeKey[] = ['LxW', 'LxH', 'WxH']

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
      return `L×W (${L}×${W})`
    case 'LxH':
      return `L×H (${L}×${H})`
    case 'WxH':
      return `W×H (${W}×${H})`
    default:
      return sizeKey
  }
}
