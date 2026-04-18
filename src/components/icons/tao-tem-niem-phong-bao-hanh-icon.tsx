'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_TEM_NIEM_PHONG_BAO_HANH_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512734065.png'

export function TaoTemNiemPhongBaoHanhIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_TEM_NIEM_PHONG_BAO_HANH_ICON_SRC} className={className} />
}
