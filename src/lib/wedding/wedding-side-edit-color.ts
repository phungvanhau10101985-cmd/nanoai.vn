import type { CSSProperties } from 'react'

/** Chế độ sửa: nhà trai / chú rể xanh, nhà gái / cô dâu hồng. Khách xem không dùng bảng này. */
export type WeddingEditSide = 'groom' | 'bride'

export const WEDDING_EDIT_SIDE = {
  groom: {
    ink: '#1d4ed8',
    wash: 'bg-blue-50',
    label: 'text-blue-700',
    solid: 'bg-blue-700',
    moveName: 'bg-blue-600',
    dial: 'bg-blue-800',
    ring: 'ring-blue-400',
    fieldBorder: 'border-blue-400',
    panelBorder: 'border-blue-200',
  },
  bride: {
    ink: '#be185d',
    wash: 'bg-pink-50',
    label: 'text-pink-700',
    solid: 'bg-pink-600',
    moveName: 'bg-pink-500',
    dial: 'bg-pink-700',
    ring: 'ring-pink-400',
    fieldBorder: 'border-pink-400',
    panelBorder: 'border-pink-200',
  },
} as const

export function weddingEditSideLabelStyle(side: WeddingEditSide, title = false): CSSProperties {
  return {
    color: WEDDING_EDIT_SIDE[side].ink,
    fontSize: title
      ? 'calc(18px / var(--wedding-stage-scale, 1))'
      : 'calc(15px / var(--wedding-stage-scale, 1))',
    lineHeight: 1.35,
    fontWeight: 700,
    textShadow: 'none',
    fontFamily: 'system-ui, "Segoe UI", sans-serif',
  }
}
