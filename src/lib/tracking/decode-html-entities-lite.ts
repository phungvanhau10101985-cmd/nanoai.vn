/** Giải mã một số entity HTML phổ biến trong tiêu đề sản phẩm (không cần DOM). */
export function decodeHtmlEntitiesLite(s: string): string {
  if (!s) return ''
  let t = s
  t = t.replace(/&nbsp;/gi, ' ')
  t = t.replace(/&amp;/g, '&')
  t = t.replace(/&lt;/g, '<')
  t = t.replace(/&gt;/g, '>')
  t = t.replace(/&quot;/g, '"')
  t = t.replace(/&#(\d+);/g, (_, n) => {
    const code = Number.parseInt(n, 10)
    return Number.isFinite(code) ? String.fromCharCode(code) : _
  })
  t = t.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
    const code = Number.parseInt(h, 16)
    return Number.isFinite(code) ? String.fromCharCode(code) : _
  })
  return t
}
