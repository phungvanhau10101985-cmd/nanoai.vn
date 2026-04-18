'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_MA_VACH_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514184037.png'

export function TaoMaVachIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_MA_VACH_ICON_SRC} className={className} />
}
