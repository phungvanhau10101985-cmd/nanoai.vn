'use client'

import { ToolIconImage } from './tool-icon-image'

const DU_ANH_TU_PHAC_THAO_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512234653.png'

export function DuAnhTuPhacThaoIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={DU_ANH_TU_PHAC_THAO_ICON_SRC} className={className} />
}
