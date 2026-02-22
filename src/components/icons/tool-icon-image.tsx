interface ToolIconImageProps {
  src: string
  className?: string
  priority?: boolean
}

export function ToolIconImage({ src, className, priority = false }: ToolIconImageProps) {
  return (
    <span
      className={`flex w-full aspect-square items-center justify-center rounded-none sm:rounded-lg overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain scale-[1.32]"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  )
}
