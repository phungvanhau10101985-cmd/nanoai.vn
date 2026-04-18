'use client'

import { ToolIconImage } from './tool-icon-image'

const INFOGRAPHIC_FROM_BOOK_ICON_SRC =
  'https://nanoai.b-cdn.net/results/ef34291c-0b83-49c1-b390-4ab50df32e9d/sticker_1776512000095.png'

export function InfographicFromBookIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src={INFOGRAPHIC_FROM_BOOK_ICON_SRC} className={className} />
}
