'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_BAI_HAT_LYRIA_3_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514289804.png'

export function TaoBaiHatLyria3Icon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_BAI_HAT_LYRIA_3_ICON_SRC} className={className} />
}
