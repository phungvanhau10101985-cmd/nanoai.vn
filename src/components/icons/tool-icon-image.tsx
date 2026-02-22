'use client'

import Image from 'next/image'

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
      <Image
        src={fullFrameSrc}
        alt=""
        width={96}
        height={96}
        sizes="(max-width: 768px) 80px, 96px"
        className="h-full w-full object-contain"
        {...(priority
          ? { priority: true, fetchPriority: 'high' as const }
          : { loading: 'lazy' as const })}
      />
    </span>
  )
}
