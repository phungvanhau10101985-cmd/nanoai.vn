/** Tên lớp và trường, luôn nằm cạnh nút quay lại khi đang ở trong lớp. */
export function ClassNameTag({ name, school = '' }: { name: string; school?: string }) {
  const className = name.trim()
  const schoolName = school.trim()
  const label = schoolName ? `${className} · ${schoolName}` : className
  if (!label) return null
  return (
    <span
      className="inline-flex h-9 min-w-0 max-w-[32rem] items-center truncate rounded-md border border-border/70 bg-background px-2.5 text-xs font-semibold text-foreground"
      title={label}
    >
      {label}
    </span>
  )
}
