import { parseStoredCurriculumSlidesJson } from '@/app/tao-giao-trinh/lib/curriculum-slides-json'
import type { AISlideData, ContentBlock } from '@/app/tao-giao-trinh/lib/curriculum-to-slides'

export function reviewSlidesFromStoredJson(raw: unknown): AISlideData[] {
  const parsed = parseStoredCurriculumSlidesJson(raw)
  const slides: AISlideData[] = []
  for (const item of parsed.slides) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const blocks = Array.isArray(row.blocks)
      ? (row.blocks as ContentBlock[]).filter((block) => block && !block.isAnswer)
      : []
    const layout = row.visualLayout === 1 || row.visualLayout === 2 || row.visualLayout === 4 ? row.visualLayout : undefined
    slides.push({
      title: String(row.title ?? '').trim(),
      blocks,
      imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : undefined,
      visualEmbed: typeof row.visualEmbed === 'string' ? row.visualEmbed : undefined,
      visualLayout: layout,
      visualCells: Array.isArray(row.visualCells) ? (row.visualCells as AISlideData['visualCells']) : undefined,
      visualInput1: typeof row.visualInput1 === 'string' ? row.visualInput1 : undefined,
      visualInput2: typeof row.visualInput2 === 'string' ? row.visualInput2 : undefined,
      visualInput3: typeof row.visualInput3 === 'string' ? row.visualInput3 : undefined,
      visualInput4: typeof row.visualInput4 === 'string' ? row.visualInput4 : undefined,
    })
  }
  return slides.filter((slide) => slide.title || slide.blocks.length > 0)
}

export function reviewMarkdownFromSlides(slides: AISlideData[]): string {
  return slides
    .map((slide) => {
      const body = slide.blocks
        .filter((block) => !block.isAnswer)
        .map((block) => `### ${block.header}\n${block.content}`)
        .join('\n\n')
      return `## ${slide.title}\n\n${body}`
    })
    .join('\n\n')
}
