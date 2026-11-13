const META_FOLDED = [
  'say one more sentence',
  'say another sentence',
  'one more sentence',
  'continue this conversation',
  'continue the conversation',
  'add one more detail',
  'say the next sentence',
  'noi them mot cau',
  'noi cau tiep theo',
  'ke hoach hom nay',
  'them mot chi tiet',
]

const META_RAW = [
  '再用一句话',
  '今天的计划',
  '我们继续',
  '再加一个细节',
  '继续这段对话',
  '一文で',
  '今日の予定',
  '続けましょう',
  '具体的な情報',
  '한 문장으로',
  '오늘 계획',
  '계속해',
  '구체적인 정보',
  'หนึ่งประโยค',
  'แผนวันนี้',
  'เรามาต่อกัน',
  'รายละเอียดอีก',
  'एक वाक्य',
  'आज की अपनी योजना',
  'आगे बढ़ते',
  'एक और विवरण',
]

function foldReply(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

const SHORT_LEAD_FOLDED = [
  "let's continue",
  'lets continue',
  'let us continue',
  'minh tiep tuc',
  'de tiep tuc',
]

export function isMetaPracticeLine(text: string): boolean {
  const raw = String(text || '').trim()
  if (!raw) return false
  if (META_RAW.some((part) => raw.includes(part))) return true
  const folded = foldReply(raw)
  if (META_FOLDED.some((part) => folded.includes(part))) return true
  const words = folded.split(/\s+/u).filter(Boolean)
  return words.length <= 6 && SHORT_LEAD_FOLDED.some((part) => folded.includes(part))
}

export function keepInCharacterReply(text: string): string {
  const parts = String(text || '')
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((part) => part.trim())
    .filter((part) => part && !isMetaPracticeLine(part))
  return parts.join(' ').trim()
}

export function hasOpeningQuestion(text: string): boolean {
  return /[?？؟]/u.test(String(text || ''))
}

export function appendOpeningQuestion(reply: string, question: string): string {
  const base = keepInCharacterReply(reply)
  const asked = keepInCharacterReply(question)
  if (!asked || !hasOpeningQuestion(asked)) return base
  if (!base) return asked
  if (hasOpeningQuestion(base)) return base
  const questions = asked
    .split(/(?<=[.!?。！？؟])\s+/u)
    .map((part) => part.trim())
    .filter((part) => /[?？؟]/u.test(part))
  const line = questions.join(' ').trim()
  if (!line) return base
  return `${base} ${line}`.trim()
}
