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
