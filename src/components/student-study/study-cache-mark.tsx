/** Chữ «c» trên đoạn trả lời đọc từ cache DB. */
export function StudyCacheMark({ label }: { label: string }) {
  return (
    <span
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-primary/40 bg-primary/10 px-1 text-[11px] font-semibold lowercase leading-none text-primary"
      title={label}
      aria-label={label}
    >
      c
    </span>
  )
}
