/** Ý 1 ngắn: một điểm cần chú ý, danh từ mới là từ = nghĩa, một hai ví dụ. */

const IDEA1_MAX_CHARS = 280

export type Idea1SectionLabels = {
  grammar: string
  words: string
  cases: string
}

export function idea1SectionLabels(nativeLanguageCode: string): Idea1SectionLabels {
  const code = String(nativeLanguageCode || '').toLowerCase().trim()
  if (code === 'en') return { grammar: 'Watch:', words: 'Word:', cases: 'Example:' }
  if (code === 'zh') return { grammar: '注意：', words: '词：', cases: '例：' }
  if (code === 'ja') return { grammar: '注意：', words: '語：', cases: '例：' }
  if (code === 'ko') return { grammar: '주의:', words: '단어:', cases: '예:' }
  if (code === 'th') return { grammar: 'ดู:', words: 'คำ:', cases: 'ตัวอย่าง:' }
  if (code === 'hi') return { grammar: 'ध्यान:', words: 'शब्द:', cases: 'उदाहरण:' }
  return { grammar: 'Chú ý:', words: 'Từ:', cases: 'Ví dụ:' }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasSectionLabel(text: string, label: string): boolean {
  const stem = label.replace(/\s*[:：]\s*$/u, '').trim()
  if (!stem) return false
  return new RegExp(`${escapeRegExp(stem)}\\s*[:：]`, 'u').test(text)
}

function idea1IsEmptyPraise(note: string, nativeLanguageCode: string): boolean {
  const code = String(nativeLanguageCode || '').toLowerCase().trim()
  if (code !== 'vi' && code !== '') return false
  return /hoàn toàn chính xác|cùng học|rất tự nhiên|đúng nghĩa/i.test(note)
}

export function idea1Teaches(text: string, nativeLanguageCode: string): boolean {
  const note = String(text || '')
  const labels = idea1SectionLabels(nativeLanguageCode)
  return note.length > 0
    && note.length <= IDEA1_MAX_CHARS
    && !idea1IsEmptyPraise(note, nativeLanguageCode)
    && hasSectionLabel(note, labels.grammar)
    && hasSectionLabel(note, labels.words)
    && hasSectionLabel(note, labels.cases)
}

export function idea1TeachingRules(input: {
  nativeLanguage: string
  targetLanguage: string
  nativeLanguageCode: string
}): string {
  const labels = idea1SectionLabels(input.nativeLanguageCode)
  return `Ý 1 (correctionNote và corrections[].explanationVi) bằng ${input.nativeLanguage}, bám câu ${input.targetLanguage}. Ngắn, cô đọng, tối đa ba dòng. Mỗi dòng một nhãn, không giảng thêm:
${labels.grammar} một điểm ngữ pháp của chính câu này. Một câu. Phải có mẫu của câu tiếng đang học. Cấm khen câu đúng hoặc tự nhiên.
${labels.words} chỉ danh từ đang có trong câu. Viết "từ = nghĩa", như "sân vận động = stadium". Cấm từ không có trong câu. Cấm giải thích, cấm phiên âm, cấm kể từ loại. Trợ từ và đuôi câu không ghi ở dòng này.
${labels.cases} một hoặc hai câu đổi đúng danh từ đó, mỗi câu có dấu = và nghĩa thẳng. Không kể tình huống. Không đổi câu gốc sang một danh từ khác.
Bắt đầu đúng bằng nhãn đầu. Cấm câu dẫn, cấm khen, cấm "hoàn toàn chính xác", "mình cùng học". Tiếng Việt gọi học viên là "em".`
}

export function idea1LockInstruction(input: {
  nativeLanguage: string
  targetLanguage: string
  nativeLanguageCode: string
  meaning: string
  sentence: string
  currentNote: string
}): string {
  const labels = idea1SectionLabels(input.nativeLanguageCode)
  return `Học sinh muốn nói: ${input.meaning}
Câu tiếng đang học: ${input.sentence || '(chưa có)'}
Giải thích hiện tại: ${input.currentNote || '(trống)'}

Viết lại correctionNote bằng ${input.nativeLanguage}. Ngắn, tối đa ba dòng, không bài giảng.
Mỗi dòng đúng một nhãn:
${labels.grammar} một điểm ngữ pháp của chính câu này. Một câu. Phải có mẫu trong câu tiếng đang học. Cấm khen.
${labels.words} chỉ danh từ đang có trong câu, dạng "từ = nghĩa". Cấm từ không có trong câu. Danh từ không giải thích. Không phiên âm. Trợ từ và đuôi câu không ghi ở dòng này.
${labels.cases} một hoặc hai câu đổi đúng danh từ đó. Mỗi câu có dấu = và nghĩa thẳng. Không đổi câu gốc sang danh từ khác.
Bắt đầu đúng bằng nhãn đầu. Không câu dẫn.
Tên riêng giữ đúng chữ trong nghĩa học sinh gửi.
Cấm "hoàn toàn chính xác", "mình cùng học", giảng hình thái, giải thích danh từ. Tiếng Việt gọi học viên là "em".
mainSentence là một câu hoàn chỉnh chỉ bằng ${input.targetLanguage}, dịch đúng nghĩa đã gửi.
Chỉ JSON:
{"correctionNote":"...","mainSentence":"..."}`
}
