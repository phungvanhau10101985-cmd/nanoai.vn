'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_ANH_TU_CHU_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512163374.png'

export function TaoAnhTuChuIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_ANH_TU_CHU_ICON_SRC} className={className} />
}
