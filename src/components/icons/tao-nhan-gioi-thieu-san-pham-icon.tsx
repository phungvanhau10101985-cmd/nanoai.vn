'use client'

import { ToolIconImage } from './tool-icon-image'

const TAO_NHAN_GIOI_THIEU_SAN_PHAM_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776515779086.png'

export function TaoNhanGioiThieuSanPhamIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={TAO_NHAN_GIOI_THIEU_SAN_PHAM_ICON_SRC} className={className} />
}
