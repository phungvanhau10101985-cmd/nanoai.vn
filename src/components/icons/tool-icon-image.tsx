'use client'

interface ToolIconImageProps {
  src: string
  className?: string
  priority?: boolean
}

export function ToolIconImage({ src, className, priority = false }: ToolIconImageProps) {
  const fullFrameSrc = src.endsWith('.webp') ? src.replace(/\.webp$/, '-full.webp') : src
  return (
    <span
      className={`flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fullFrameSrc}
        alt=""
        className="h-full w-full object-contain"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  )
}
