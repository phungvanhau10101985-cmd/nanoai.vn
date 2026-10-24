export type TextSpan = { text: string; changed: boolean }

function mergeSpans(parts: Array<{ text: string; changed: boolean }>): TextSpan[] {
  const spans: TextSpan[] = []
  for (const part of parts) {
    if (!part.text) continue
    const last = spans[spans.length - 1]
    if (last && last.changed === part.changed) last.text += part.text
    else spans.push({ text: part.text, changed: part.changed })
  }
  return spans
}

/** Chỗ giống giữ nguyên. Chỗ chỉ có một bên, hoặc khác chữ, đánh dấu changed. */
export function diffTextSpans(original: string, edited: string): { original: TextSpan[]; edited: TextSpan[] } {
  if (original === edited) {
    return {
      original: original ? [{ text: original, changed: false }] : [],
      edited: edited ? [{ text: edited, changed: false }] : [],
    }
  }
  const left = Array.from(original)
  const right = Array.from(edited)
  const n = left.length
  const m = right.length
  const cols = m + 1
  const dp = new Uint32Array((n + 1) * cols)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const at = i * cols + j
      if (left[i - 1] === right[j - 1]) dp[at] = dp[(i - 1) * cols + (j - 1)] + 1
      else dp[at] = Math.max(dp[(i - 1) * cols + j], dp[i * cols + (j - 1)])
    }
  }
  const leftParts: Array<{ text: string; changed: boolean }> = []
  const rightParts: Array<{ text: string; changed: boolean }> = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      leftParts.push({ text: left[i - 1]!, changed: false })
      rightParts.push({ text: right[j - 1]!, changed: false })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i * cols + (j - 1)] >= dp[(i - 1) * cols + j])) {
      rightParts.push({ text: right[j - 1]!, changed: true })
      j--
    } else {
      leftParts.push({ text: left[i - 1]!, changed: true })
      i--
    }
  }
  leftParts.reverse()
  rightParts.reverse()
  return { original: mergeSpans(leftParts), edited: mergeSpans(rightParts) }
}
