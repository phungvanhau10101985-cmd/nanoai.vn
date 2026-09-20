/** JSON text in admin inventory image cells — same shape as 188 `productFieldToJsonCellText`. */
export function inventoryFieldToJsonCellText(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (
      (text.startsWith('[') && text.endsWith(']')) ||
      (text.startsWith('{') && text.endsWith('}'))
    ) {
      try {
        return JSON.stringify(JSON.parse(text))
      } catch {
        /* keep original */
      }
    }
    return JSON.stringify(raw)
  }
  try {
    return JSON.stringify(raw)
  } catch {
    return String(raw)
  }
}
