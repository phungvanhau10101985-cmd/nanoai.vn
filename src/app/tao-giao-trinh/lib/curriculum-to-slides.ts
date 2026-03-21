/**
 * Chuyển giáo trình Markdown sang slide bài giảng (Marp format).
 * Mỗi ## hoặc ### thành một slide.
 */
import { latexToReadable } from './latex-to-readable'

export interface Slide {
  title: string
  content: string
}

/**
 * Parse giáo trình Markdown thành các slide.
 * - ## Tiêu đề → slide mới
 * - ### Mục con → slide mới (hoặc gộp vào slide trước nếu content ngắn)
 */
export function parseCurriculumToSlides(markdown: string): Slide[] {
  const slides: Slide[] = []
  const lines = markdown.split(/\r?\n/)
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h1Match = line.match(/^#\s+(.+)$/)
    const h2Match = line.match(/^##\s+(.+)$/)
    const h3Match = line.match(/^###\s+(.+)$/)
    const headerMatch = h1Match || h2Match || h3Match

    if (headerMatch) {
      flushSlide()
      currentTitle = headerMatch[1].trim()
      let j = i + 1
      while (j < lines.length && !lines[j].match(/^#{1,3}\s/)) {
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
  return slides
}

/** Chuyển slide sang Marp Markdown */
export function slidesToMarpMarkdown(slides: Slide[], topic: string): string {
  const header = `---
marp: true
theme: default
paginate: true
style: |
  section { font-size: 26px; }
  h1, h2 { color: #1e40af; }
  ul { margin-left: 1.5em; }
---

`
  const titleSlide = topic ? `---
# ${topic}
## Slide bài giảng
---
` : ''
  const slideBlocks = slides.map((s) => {
    const content = s.content.trim()
    const body = content ? `\n\n${content}` : ''
    return `---
## ${s.title}${body}
`
  })
  return header + titleSlide + slideBlocks.join('')
}

/** Từ giáo trình → Marp Markdown (đã áp latexToReadable) */
export function curriculumToSlidesMarkdown(curriculumMarkdown: string, topic: string): string {
  const readable = latexToReadable(curriculumMarkdown)
  const slides = parseCurriculumToSlides(readable)
  return slidesToMarpMarkdown(slides, topic)
}

/** Block nội dung: tiêu đề + nội dung (từ ### hoặc dòng in đậm) */
export interface ContentBlock {
  header: string
  content: string
  /** Block đáp án – giáo viên có thể ẩn/hiện trên giao diện học sinh */
  isAnswer?: boolean
}

/** Slide từ AI: đã có sẵn blocks, không cần parse */
export interface AISlideData {
  title: string
  blocks: ContentBlock[]
  /** URL ảnh minh họa phù hợp nội dung */
  imageUrl?: string
  /** Embed marker [youtube:...], [image:...] – ưu tiên hơn imageUrl */
  visualEmbed?: string
  /** 1=toàn bộ, 2=chia 2 (trên/dưới), 4=chia 4 ô */
  visualLayout?: 1 | 2 | 4
  /** Nội dung từng ô */
  visualCells?: Array<{ visualEmbed?: string; imageUrl?: string }>
  /** 4 trường dữ liệu visual theo từng slide */
  visualInput1?: string
  visualInput2?: string
  visualInput3?: string
  visualInput4?: string
}

/** Parse nội dung slide thành các block (Định nghĩa, Quy tắc, Khởi động...) */
export function parseContentToBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const lines = content.split(/\r?\n/)
  let currentHeader = ''
  let currentContent: string[] = []

  const flush = () => {
    const text = currentContent.join('\n').trim()
    if (currentHeader || text) {
      blocks.push({ header: currentHeader || 'Nội dung', content: text })
    }
    currentHeader = ''
    currentContent = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h3Match = line.match(/^###\s+(.+)$/)
    const numBoldMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/)
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*[-–—:]?\s*(.*)$/)

    if (h3Match) {
      flush()
      currentHeader = h3Match[1].trim()
      let j = i + 1
      while (j < lines.length && !lines[j].match(/^###\s/) && !lines[j].match(/^\d+\.\s+\*\*.+\*\*/)) {
        currentContent.push(lines[j])
        j++
      }
      i = j - 1
      flush()
    } else if (numBoldMatch) {
      flush()
      currentHeader = numBoldMatch[1].trim()
      const rest = line.replace(/^\d+\.\s+\*\*.+?\*\*\s*[-–—:]?\s*/, '').trim()
      if (rest) currentContent.push(rest)
      let j = i + 1
      while (j < lines.length && !lines[j].match(/^\d+\.\s+\*\*.+\*\*/) && !lines[j].match(/^###\s/)) {
        currentContent.push(lines[j])
        j++
      }
      i = j - 1
      flush()
    } else if (boldMatch && boldMatch[1].length < 50) {
      flush()
      currentHeader = boldMatch[1].trim()
      if (boldMatch[2]) currentContent.push(boldMatch[2])
      let j = i + 1
      while (j < lines.length && !lines[j].match(/^\*\*.+\*\*/) && !lines[j].match(/^###\s/)) {
        currentContent.push(lines[j])
        j++
      }
      i = j - 1
      flush()
    } else if (!currentHeader && line.trim()) {
      currentContent.push(line)
    }
  }
  flush()
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ header: 'Nội dung', content: content.trim() })
  }
  return blocks
}
