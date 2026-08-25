/** Hex user chọn ở bảng màu Sửa nhanh — đưa vào prompt mọi lần tạo ảnh AI. */

function normalizeHex(raw: string | null | undefined): string {
  const s = String(raw || '').trim()
  const m6 = s.match(/^#?([0-9a-fA-F]{6})$/)
  if (m6) return `#${m6[1].toLowerCase()}`
  const m3 = s.match(/^#?([0-9a-fA-F]{3})$/)
  if (m3) {
    const [a, b, c] = m3[1].toLowerCase().split('')
    return `#${a}${a}${b}${b}${c}${c}`
  }
  return ''
}

export function buildAiImageColorFacts(colors: { main?: string | null; accent?: string | null }): string {
  const main = normalizeHex(colors.main)
  const accent = normalizeHex(colors.accent)
  const parts: string[] = []
  if (main) parts.push(`main ${main}`)
  if (accent && accent !== main) parts.push(`supporting ${accent}`)
  if (!parts.length) return ''
  return `Use ONLY these user-picked colors from the editor color picker: ${parts.join(', ')}. Do not invent a different palette and do not sample colors from the shop UI, theme tokens, or page screenshot unless they match these hex values.`
}

export function mergeAiImageColorPrompt(
  userPrompt: string,
  colors: { main?: string | null; accent?: string | null }
): string {
  const facts = buildAiImageColorFacts(colors)
  const trimmed = String(userPrompt || '').trim()
  if (!facts) return trimmed
  if (!trimmed) return facts
  return `${trimmed}. ${facts}`
}
