'use client'

import { ToolIconImage } from './tool-icon-image'

export function TryOnIcon({ className }: { className?: string; strokeWidth?: number }) {
  return <ToolIconImage src="/tool-icons/try-on.webp" className={className} />
}
