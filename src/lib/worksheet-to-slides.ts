/**
 * Parse phiếu bài tập (content_markdown) thành slides để trình chiếu.
 * Mỗi câu hỏi (1., 2., 3. hoặc Câu 1., Câu 2.) = 1 slide.
 * Nếu không có đánh số câu hỏi thì dùng ## / ### như curriculum.
 */
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import type { AISlideData, ContentBlock, Slide } from '@/app/tao-giao-trinh/lib/curriculum-to-slides'
import { parseCurriculumToSlides, parseContentToBlocks } from '@/app/tao-giao-trinh/lib/curriculum-to-slides'
import { compareExerciseIndexParsed, parseExerciseIndex } from '@/lib/worksheet-exercise-sort'

/** Regex: dòng bắt đầu bằng Đáp án / Lời giải – tách block đáp án */
const ANSWER_MARKER = /^\s*\*?\*?(?:Đáp án|Lời giải)\*?\*?\s*[:：]?\s*(.*)$/im

/**
 * Parse nội dung slide phiếu bài tập thành blocks – tách phần câu hỏi và phần đáp án.
 * Phần sau "Đáp án:", "**Đáp án:**", "Lời giải:" → block có isAnswer: true.
 */
function parseWorksheetContentToBlocks(content: string): ContentBlock[] {
  const raw = content.trim()
  if (!raw) return [{ header: 'Nội dung', content: '' }]
  const lines = raw.split(/\r?\n/)
  let splitIdx = -1
  let answerHeader = 'Đáp án'
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ANSWER_MARKER)
    if (m) {
      splitIdx = i
      if (/Lời giải/i.test(m[0])) answerHeader = 'Lời giải'
      break
    }
  }
  if (splitIdx < 0) {
    const fromDefault = parseContentToBlocks(raw)
    return fromDefault.length > 0 ? fromDefault : [{ header: 'Nội dung', content: raw }]
  }
  const questionLines = lines.slice(0, splitIdx)
  const answerLines = lines.slice(splitIdx)
  const questionContent = questionLines.join('\n').trim()
  const answerContent = answerLines.join('\n').trim()
  const questionBlocks = questionContent ? parseContentToBlocks(questionContent) : []
  const blocks: ContentBlock[] = questionBlocks.length > 0 ? questionBlocks : [{ header: 'Nội dung', content: questionContent || '' }]
  if (answerContent) {
    blocks.push({ header: answerHeader, content: answerContent, isAnswer: true })
  }
  return blocks
}

/** Regex: dòng bắt đầu bằng "1. ", "2. " hoặc "Câu 1.", "Câu 2." */
const QUESTION_START = /^(\d+)\.\s*(.*)$|^Câu\s*(\d+)\.?\s*(.*)$/i

/** Regex: **Bài 1.**, **Bài 2.** – tách mỗi bài thành 1 slide */
const BAI_BLOCK = /(\*\*Bài\s*(\d+)\.\*\*)/

/** Tách slide có nhiều **Bài X.** thành nhiều slide (mỗi bài một slide). */
function splitSlideByBaiBlocks(slide: Slide): Slide[] {
  const content = slide.content.trim()
  const parts = content.split(BAI_BLOCK)
  if (parts.length < 4) return [slide]
  const result: Slide[] = []
  for (let i = 1; i < parts.length; i += 3) {
    const delimiter = parts[i] ?? ''
    const numStr = parts[i + 1] ?? String(result.length + 1)
    const after = parts[i + 2] ?? ''
    const blockContent = (delimiter + after).trim()
    if (blockContent) {
      result.push({ title: `${slide.title} – Bài ${numStr}`, content: blockContent })
    }
  }
  return result.length >= 2 ? result : [slide]
}

/** Nội dung dùng để parse số thứ tự (1.8 < 1.9) khi sắp xếp slide. */
function previewTextForSlideSort(s: AISlideData): string {
  const parts: string[] = [s.title]
  for (const b of s.blocks) {
    if (!b.isAnswer && b.content) parts.push(b.content)
  }
  return parts.join('\n')
}

/** Sắp xếp slide theo chỉ số bài trong nội dung; giữ thứ tự gốc khi không parse được. */
function sortAiSlidesByExerciseIndex(slides: AISlideData[]): AISlideData[] {
  return slides
    .map((slide, originalIndex) => ({ slide, originalIndex }))
    .sort((a, b) => {
      const pa = parseExerciseIndex('', previewTextForSlideSort(a.slide))
      const pb = parseExerciseIndex('', previewTextForSlideSort(b.slide))
      return compareExerciseIndexParsed(pa, pb, () => a.originalIndex - b.originalIndex)
    })
    .map(({ slide }) => slide)
}

/**
 * Chuyển phiếu bài tập markdown thành AISlideData[] – mỗi câu hỏi/bài một slide.
 */
export function parseWorksheetToSlides(markdown: string): AISlideData[] {
  const readable = latexToReadable(markdown)
  const lines = readable.split(/\r?\n/)
  const slides: Slide[] = []
  let currentTitle = ''
  let currentContent: string[] = []

  const flushSlide = () => {
    if (currentTitle || currentContent.length > 0) {
      slides.push({
        title: currentTitle || 'Slide',
        content: currentContent.join('\n').trim(),
      })
      currentTitle = ''
      currentContent = []
    }
  }

  const hasNumberedQuestions = lines.some((l) => QUESTION_START.test(l))

  if (!hasNumberedQuestions) {
    let fromCurriculum = parseCurriculumToSlides(readable)
    fromCurriculum = fromCurriculum.flatMap((s) => splitSlideByBaiBlocks(s))
    const mapped = fromCurriculum.map((s) => {
      const blocks = parseWorksheetContentToBlocks(s.content)
      return {
        title: s.title,
        blocks: blocks.length > 0 ? blocks : [{ header: 'Nội dung', content: s.content.trim() || '' }],
      }
    })
    return sortAiSlidesByExerciseIndex(mapped)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const qMatch = line.match(QUESTION_START)
    if (qMatch) {
      flushSlide()
      const num = qMatch[1] ?? qMatch[3] ?? '1'
      const rest = (qMatch[2] ?? qMatch[4] ?? '').trim()
      currentTitle = `Câu ${num}`
      if (rest) currentContent.push(rest)
      let j = i + 1
      while (j < lines.length && !lines[j].match(QUESTION_START)) {
        currentContent.push(lines[j])
        j++
      }
      i = j - 1
      flushSlide()
    } else if (line.trim()) {
      currentContent.push(line)
    }
  }

  flushSlide()

  if (slides.length === 0) {
    let fromCurriculum = parseCurriculumToSlides(readable)
    fromCurriculum = fromCurriculum.flatMap((s) => splitSlideByBaiBlocks(s))
    const mapped = fromCurriculum.map((s) => {
      const blocks = parseWorksheetContentToBlocks(s.content)
      return {
        title: s.title,
        blocks: blocks.length > 0 ? blocks : [{ header: 'Nội dung', content: s.content.trim() || '' }],
      }
    })
    return sortAiSlidesByExerciseIndex(mapped)
  }

  const expandedSlides = slides.flatMap((s) => splitSlideByBaiBlocks(s))
  const mapped = expandedSlides.map((s) => {
    const raw = s.content.trim()
    if (!raw) return { title: s.title, blocks: [{ header: 'Nội dung', content: '' }] }
    const blocks = parseWorksheetContentToBlocks(raw)
    return {
      title: s.title,
      blocks: blocks.length > 0 ? blocks : [{ header: 'Nội dung', content: raw }],
    }
  })
  return sortAiSlidesByExerciseIndex(mapped)
}

/**
 * Chuyển worksheet_questions (content_json) trực tiếp sang slides – mỗi câu = 1 slide.
 * Mỗi slide có block đáp án riêng (isAnswer: true) để giáo viên ẩn/hiện trên giao diện học sinh.
 */
export function questionsToSlides(questions: Array<{ type: string; content_json: unknown }>): AISlideData[] {
  type Row = {
    blocks: ContentBlock[]
    preview: string
    typeOrder: number
    originalIndex: number
  }
  const rows: Row[] = []
  let idx = 0
  for (const q of questions) {
    idx++
    const blocks: ContentBlock[] = []
    let preview = ''
    if (q.type === 'quiz') {
      const c = q.content_json as { question?: string; options?: string[]; correctIndex?: number }
      preview = c.question ?? ''
      const opts = (c.options ?? []).slice(0, 4)
      const questionText = [c.question ?? '', ...opts.map((o, i) => `   ${String.fromCharCode(65 + i)}. ${o}`)].join('\n').trim()
      blocks.push({ header: 'Câu hỏi', content: questionText })
      const ans = String.fromCharCode(65 + (c.correctIndex ?? 0))
      blocks.push({ header: 'Đáp án', content: ans, isAnswer: true })
    } else if (q.type === 'essay') {
      const c = q.content_json as { problem?: string; solution?: string }
      preview = c.problem ?? ''
      blocks.push({ header: 'Đề bài', content: c.problem ?? '' })
      blocks.push({ header: 'Lời giải', content: c.solution ?? '', isAnswer: true })
    }
    if (blocks.length > 0) {
      rows.push({
        blocks,
        preview,
        typeOrder: q.type === 'quiz' ? 0 : 1,
        originalIndex: idx - 1,
      })
    }
  }
  rows.sort((a, b) => {
    const pa = parseExerciseIndex('', a.preview)
    const pb = parseExerciseIndex('', b.preview)
    return compareExerciseIndexParsed(pa, pb, () => {
      if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder
      return a.originalIndex - b.originalIndex
    })
  })
  return rows.map((r, k) => {
    const p = parseExerciseIndex('', r.preview)
    const title = p ? `Câu ${p.major}.${p.minor}` : `Câu ${k + 1}`
    return { title, blocks: r.blocks }
  })
}

/** Dữ liệu từ GET `/api/exam-session/[code]/review` — build slide giống cấu trúc phiếu bài tập (Câu hỏi + Đáp án / Đề + Lời giải). */
export type ExamReviewQuestionInput = {
  index: number
  questionText: string
  options: string[]
  source: string
  correctIndex: number
  correctLabel: string | null
  correctOption: string
}

export function examReviewQuestionsToSlides(questions: ExamReviewQuestionInput[]): AISlideData[] {
  return questions.map((q) => {
    const opts = Array.isArray(q.options) ? q.options.map((x) => String(x ?? '').trim()).filter(Boolean) : []
    const hasChoice = opts.length >= 2
    const src = String(q.source ?? '').trim()
    const sourceLine = src ? `\n\n(Nguồn: ${src})` : ''
    if (hasChoice) {
      const questionText = [String(q.questionText ?? '').trim(), ...opts.map((o, i) => `   ${String.fromCharCode(65 + i)}. ${o}`)]
        .filter(Boolean)
        .join('\n')
        .trim()
      const blocks: ContentBlock[] = [
        { header: 'Câu hỏi', content: `${questionText}${sourceLine}`.trim() },
        {
          header: 'Đáp án',
          content: q.correctLabel ? `${q.correctLabel}. ${q.correctOption}` : String(q.correctOption ?? ''),
          isAnswer: true,
        },
      ]
      return { title: `Câu ${q.index}`, blocks }
    }
    const blocks: ContentBlock[] = [
      { header: 'Đề bài', content: `${String(q.questionText ?? '').trim()}${sourceLine}`.trim() },
      {
        header: 'Lời giải',
        content: String(q.correctOption ?? '').trim() || '(Chưa có lời giải)',
        isAnswer: true,
      },
    ]
    return { title: `Câu ${q.index}`, blocks }
  })
}
