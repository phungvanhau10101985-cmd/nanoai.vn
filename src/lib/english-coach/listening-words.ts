const READING_LABEL_LINE = /^\s*(?:pinyin|romaji|romanization|phiên\s*âm|phien\s*am)\s*[:：]/i
const READING_LABEL_TOKEN = /^(?:pinyin|romaji|romanization)$/i

export type LessonScript = 'zh' | 'ja' | 'ko' | 'th' | 'hi'

const SCRIPT_RE: Record<LessonScript, RegExp> = {
  zh: /[\u3400-\u9fff]/,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/,
  ko: /[\uac00-\ud7af]/,
  th: /[\u0e00-\u0e7f]/,
  hi: /[\u0900-\u097f]/,
}

/** Bỏ dòng nhãn phiên âm. Phần còn lại là câu của bài. */
export function stripReadingLabels(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !READING_LABEL_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isReadingLabelToken(token: string): boolean {
  return READING_LABEL_TOKEN.test(String(token || '').trim())
}

function inferScript(text: string): LessonScript | null {
  const sample = String(text || '')
  if (/[\u3040-\u30ff]/.test(sample)) return 'ja'
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko'
  if (/[\u0e00-\u0e7f]/.test(sample)) return 'th'
  if (/[\u0900-\u097f]/.test(sample)) return 'hi'
  if (/[\u3400-\u9fff]/.test(sample)) return 'zh'
  return null
}

function textMostlyScript(text: string, script: LessonScript): boolean {
  const chars = Array.from(String(text || '').replace(/\s/g, ''))
  if (chars.length === 0) return false
  const hit = chars.filter((ch) => SCRIPT_RE[script].test(ch)).length
  return hit * 2 >= chars.length
}

export function lessonScriptOf(languageCode: string | undefined, text: string): LessonScript | null {
  const code = String(languageCode || '').toLowerCase().split(/[-_]/)[0]
  if (code === 'zh' || code === 'ja' || code === 'ko' || code === 'th' || code === 'hi') return code
  const fromText = inferScript(text)
  if (code === 'en' || code === 'vi') {
    if (fromText && textMostlyScript(text, fromText)) return fromText
    return null
  }
  return fromText
}

export function isLessonContentToken(token: string, script: LessonScript | null, dropLabel: boolean): boolean {
  const t = String(token || '').trim()
  if (!t) return false
  if (dropLabel && isReadingLabelToken(t)) return false
  if (script && !SCRIPT_RE[script].test(t)) return false
  return true
}

function segmentWords(text: string, script: LessonScript | null): string[] {
  const cleaned = stripReadingLabels(text)
  if (script && typeof Intl.Segmenter === 'function') {
    try {
      const seg = new Intl.Segmenter(script, { granularity: 'word' })
      const out: string[] = []
      for (const part of seg.segment(cleaned)) {
        if (part.isWordLike === false) continue
        const token = String(part.segment || '').trim()
        if (token) out.push(token)
      }
      const usable = out.filter((token) => isLessonContentToken(token, script, true))
      if (usable.length >= 3) return out
    } catch {
      // Máy không có bộ tách từ thì tách theo cụm chữ bên dưới.
    }
  }
  const rough = cleaned
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (!script) return rough
  const pieces: string[] = []
  for (const token of rough) {
    if (!SCRIPT_RE[script].test(token)) continue
    const chars = Array.from(token).filter((ch) => SCRIPT_RE[script].test(ch))
    if (chars.length <= 2) {
      if (chars.length > 0) pieces.push(chars.join(''))
      continue
    }
    for (let i = 0; i < chars.length; i += 2) pieces.push(chars.slice(i, i + 2).join(''))
  }
  return pieces
}

function normalizeToken(token: string, script: LessonScript | null): string {
  const t = String(token || '').trim()
  if (!t) return ''
  return script ? t : t.toLowerCase()
}

/** Từ của câu nghe. Nhãn và dòng phiên âm không được vào danh sách. */
export function lessonListeningWords(text: string, languageCode?: string): string[] {
  const original = String(text || '')
  const prompt = stripReadingLabels(original)
  const script = lessonScriptOf(languageCode, prompt)
  const dropLabel = script !== null || READING_LABEL_LINE.test(original)
  const minLen = script ? 1 : 2
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of segmentWords(prompt, script)) {
    const token = normalizeToken(raw, script)
    if (token.length < minLen) continue
    if (!isLessonContentToken(token, script, dropLabel)) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(token)
    if (out.length >= 24) break
  }
  return out
}

/**
 * Danh sách từ đã lưu vẫn có thể chứa nhãn. Giữ từ thuộc câu;
 * nếu không đủ 3 từ của bài thì tách lại từ câu đã bỏ nhãn.
 */
export function prepareListeningWords(
  keywords: readonly unknown[] | null | undefined,
  prompt: string,
  languageCode?: string,
): { prompt: string; words: string[] } {
  const original = String(prompt || '')
  const cleanPrompt = stripReadingLabels(original)
  const script = lessonScriptOf(languageCode, `${original}\n${cleanPrompt}`)
  const dropLabel = script !== null || READING_LABEL_LINE.test(original)
  const sentence = cleanPrompt.toLowerCase()
  const filtered: string[] = []
  const seen = new Set<string>()
  for (const raw of keywords || []) {
    const token = normalizeToken(String(raw || ''), script)
    if (!token || !isLessonContentToken(token, script, dropLabel)) continue
    if (sentence && !sentence.includes(token.toLowerCase())) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    filtered.push(token)
    if (filtered.length >= 24) break
  }
  const words = filtered.length >= 3
    ? filtered
    : lessonListeningWords(cleanPrompt, languageCode || script || undefined)
  return { prompt: cleanPrompt, words }
}

/** Lựa chọn nghe: bỏ nhãn, giữ từ nhiễu đúng chữ của ngôn ngữ bài. */
export function filterListeningOptions(
  options: readonly unknown[] | null | undefined,
  prompt: string,
  languageCode?: string,
): string[] {
  const script = lessonScriptOf(languageCode, prompt)
  const dropLabel = script !== null || READING_LABEL_LINE.test(String(prompt || ''))
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of options || []) {
    const token = normalizeToken(String(raw || ''), script)
    if (!token || !isLessonContentToken(token, script, dropLabel)) continue
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(token)
    if (out.length >= 24) break
  }
  return out
}
