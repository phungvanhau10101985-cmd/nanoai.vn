/** Con trỏ gõ chữ: nét đứng cao bằng dòng, dày theo cỡ chữ. */
export function textCaretRect(x: number, y: number, fontSize: number, advance = 0) {
  const size = Math.max(1, fontSize)
  const thickness = Math.max(2, Math.round(size / 14))
  const height = Math.max(thickness + 1, Math.round(size))
  return {
    x: Math.round(x + Math.max(0, advance)),
    y: Math.round(y),
    w: thickness,
    h: height,
  }
}
