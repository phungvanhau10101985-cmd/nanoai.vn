import { hasChineseText } from './image-localization-classifier'
import type { ImageLocOcrBlock } from './image-localization-types'

/** Chỉ các ô còn chữ Trung. Không kéo ô số đo bên cạnh vào, kẻo tô đè bảng. */
export function chineseBlocksToRedraw(blocks: ImageLocOcrBlock[]): ImageLocOcrBlock[] {
  return blocks.filter((block) => !block.layoutOnly && hasChineseText(block.text || ''))
}

export function remainingChineseOnLocalizedImage(texts: string[]): string[] {
  const left: string[] = []
  for (const raw of texts) {
    const text = String(raw || '').trim()
    if (text && hasChineseText(text)) left.push(text)
  }
  return left
}

/** Mực loang thì GPT vẽ lại cả ảnh. Chỉ còn chữ Trung thì DeepSeek vẽ đúng các ô đó. */
export function localizedImageFix(opts: { bleed: boolean; chineseCount: number }): 'ok' | 'gpt' | 'deepseek' {
  if (opts.bleed) return 'gpt'
  if (opts.chineseCount > 0) return 'deepseek'
  return 'ok'
}

export function localizedImageProblem(opts: { bleed: boolean; where?: string; chinese: string[] }): string {
  const parts: string[] = []
  if (opts.bleed) parts.push(opts.where ? `mực loang: ${opts.where}` : 'mực loang')
  if (opts.chinese.length) parts.push(`còn chữ Trung: ${opts.chinese.slice(0, 4).join(' | ').slice(0, 180)}`)
  return parts.join(' — ')
}

export function parseInkBleedVerdict(raw: string): { bleed: boolean; where: string } | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { bleed?: unknown; where?: unknown }
    if (typeof parsed.bleed !== 'boolean') return null
    return {
      bleed: parsed.bleed,
      where: String(parsed.where || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    }
  } catch {
    return null
  }
}
