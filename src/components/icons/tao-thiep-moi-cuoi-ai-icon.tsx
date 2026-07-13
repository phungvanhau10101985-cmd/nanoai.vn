'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_THIEP_MOI_CUOI_AI_ICON_SRC =
  'https://cdn.nanoai.vn/results/7e674071-e288-4c4c-ba3c-d7b39a2bcb17/sticker_1783938451941.png'

export function TaoThiepMoiCuoiAiIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_THIEP_MOI_CUOI_AI_ICON_SRC} className={className} />
}
