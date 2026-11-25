/** Trộn bản sao. Cùng một lần mở đề dùng một kết quả; lần mở sau gọi lại. */
export function shufflePaperOptions(options: readonly string[], random: () => number = Math.random): string[] {
  const next = options.map((item) => String(item ?? ''))
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const swap = next[i] ?? ''
    next[i] = next[j] ?? ''
    next[j] = swap
  }
  return next
}
