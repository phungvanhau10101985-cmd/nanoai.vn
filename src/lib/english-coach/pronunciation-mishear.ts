/** Từ tiếng mẹ đẻ trong câu máy nghe, khi nghĩa muốn nói đã có từ đích tương ứng, là phát âm bị nghe nhầm. */

export type PronunciationMishear = {
  heard: string
  meant: string
  target: string
  reading: string
}

function hasWord(text: string, word: string): boolean {
  const folded = String(text || '').normalize('NFC').toLowerCase()
  const escaped = word.normalize('NFC').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'u').test(folded)
}

export function pronunciationMishears(input: {
  transcript: string
  meaning: string
  targetLanguageCode: string
  nativeLanguageCode: string
}): PronunciationMishear[] {
  const transcript = String(input.transcript || '').trim()
  const meaning = String(input.meaning || '').trim()
  const target = String(input.targetLanguageCode || '').trim().toLowerCase()
  const native = String(input.nativeLanguageCode || '').trim().toLowerCase()
  if (!transcript || !meaning) return []
  if (target !== 'zh' || native !== 'vi') return []
  if (/我/.test(transcript)) return []
  if (!hasWord(transcript, 'của') && !hasWord(transcript, 'cua')) return []
  if (hasWord(meaning, 'của') || hasWord(meaning, 'cua')) return []
  if (!hasWord(meaning, 'tôi') && !hasWord(meaning, 'mình')) return []
  return [{ heard: 'của', meant: 'tôi', target: '我', reading: 'wǒ' }]
}

export function pronunciationMishearGuide(input: {
  transcript: string
  meaning: string
  targetLanguage: string
  nativeLanguage: string
  targetLanguageCode: string
  nativeLanguageCode: string
}): string {
  const transcript = String(input.transcript || '').trim()
  const meaning = String(input.meaning || '').trim()
  if (!transcript || !meaning) return ''
  const hits = pronunciationMishears(input)
  const lines = [
    'SO SÁNH CÂU NGHE VỚI NGHĨA MUỐN NÓI:',
    `Câu máy nghe: ${transcript}`,
    `Nghĩa muốn nói: ${meaning}`,
    `Từ ${input.nativeLanguage} trong câu máy nghe, nếu đứng vào chỗ một từ ${input.targetLanguage} của nghĩa muốn nói, là học sinh đã đọc từ đó nhưng phát âm chưa rõ nên máy ghi nhầm.`,
    'Đó không phải học sinh cố chọn từ tiếng mẹ đẻ vì không biết từ.',
    `Ý 1 phải hướng dẫn học sinh đọc đúng từ ${input.targetLanguage} để máy nghe ra từ đó.`,
    'Cấm giải thích từ tiếng mẹ đẻ bị nghe nhầm như lỗi ngữ pháp hay như học sinh không biết từ ấy không dùng được.',
  ]
  for (const hit of hits) {
    lines.push(
      `Lượt này: "${hit.heard}" là máy nghe nhầm "${hit.target}" (${hit.reading}), vì nghĩa muốn nói là "${hit.meant}". Hướng dẫn đọc ${hit.reading} cho rõ. Cấm nói "${hit.heard}" không phải "${hit.meant}", và cấm nói "${hit.heard}" không được dùng trong câu.`,
    )
  }
  return lines.join('\n')
}
