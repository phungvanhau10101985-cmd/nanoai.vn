'use client'

import { ToolIconImage } from './tool-icon-image'

const THIET_KE_BAO_BI_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776514062010.png'

export function ThietKeBaoBiIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={THIET_KE_BAO_BI_ICON_SRC} className={className} />
}
