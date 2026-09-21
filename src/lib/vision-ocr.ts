/**
 * Google Cloud Vision API – Document OCR.
 * Dùng cho hậu kiểm dịch ảnh tài liệu: phát hiện chữ còn sót (ngôn ngữ nguồn).
 * `fullTextAnnotation.boundingBox.vertices` của Vision REST đã là tọa độ pixel.
 */

import sharp from 'sharp'
import { visionAnnotate, type VisionUsageLog } from './vision-api'

const LARGE_IMAGE_INPUT = { limitInputPixels: false, sequentialRead: true } as const

export interface TextWithBbox {
  text: string
  /** x, y, width, height (pixels) */
  bbox: { x: number; y: number; width: number; height: number }
}

interface Vertex { x?: number; y?: number }
interface BoundingPoly { vertices?: Vertex[] }

export function visionVerticesToPixelRect(
  vertices: Vertex[],
  imgW: number,
  imgH: number
): { x: number; y: number; width: number; height: number } {
  const xs = vertices.map((v) => v.x ?? 0).filter((x) => x >= 0)
  const ys = vertices.map((v) => v.y ?? 0).filter((y) => y >= 0)
  if (xs.length === 0 || ys.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const looksNormalized = Math.max(...xs) <= 1 && Math.max(...ys) <= 1
  const px = looksNormalized ? xs.map((x) => x * imgW) : xs
  const py = looksNormalized ? ys.map((y) => y * imgH) : ys
  const x = Math.min(...px)
  const y = Math.min(...py)
  const width = Math.max(...px) - x
  const height = Math.max(...py) - y
  return { x, y, width: Math.max(1, width), height: Math.max(1, height) }
}

function getWordText(w: { symbols?: Array<{ text?: string }>; text?: { text?: string } }): string {
  if (w.symbols?.length) return w.symbols.map((s) => s.text ?? '').join('')
  return (w.text as { text?: string })?.text ?? ''
}

function extractWords(
  node: {
    words?: Array<{
      symbols?: Array<{ text?: string }>
      text?: { text?: string }
      boundingBox?: BoundingPoly
      bounding_box?: BoundingPoly
    }>
  },
  imgW: number,
  imgH: number
): TextWithBbox[] {
  const out: TextWithBbox[] = []
  const words = node.words ?? []
  for (const w of words) {
    const text = getWordText(w).trim()
    const verts = (w.boundingBox ?? w.bounding_box)?.vertices
    if (!text || !verts?.length) continue
    const bbox = visionVerticesToPixelRect(verts, imgW, imgH)
    if (bbox.width > 0 && bbox.height > 0) {
      out.push({ text, bbox })
    }
  }
  return out
}

interface BlockWithParagraphs {
  confidence?: number
  paragraphs?: Array<{
    confidence?: number
    words?: Array<{
      symbols?: Array<{ text?: string }>
      text?: { text?: string }
      boundingBox?: BoundingPoly
      bounding_box?: BoundingPoly
    }>
  }>
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const CM_DIMENSION_RE = /^\d+(?:[.,]\d+)?cm$/i

function splitParagraphCmCjk(
  words: NonNullable<NonNullable<BlockWithParagraphs['paragraphs']>[number]['words']>,
  paragraphText: string,
  fallback: TextWithBbox,
  imgW: number,
  imgH: number
): TextWithBbox[] {
  if (!/\d+(?:[.,]\d+)?\s*cm(?!\w)/i.test(paragraphText.normalize('NFKC'))) return [fallback]
  const ordered = words
    .map((word) => {
      const text = getWordText(word)
      const vertices = (word.boundingBox ?? word.bounding_box)?.vertices
      return vertices?.length ? { text, bbox: visionVerticesToPixelRect(vertices, imgW, imgH) } : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const chunks: Array<{ kind: 'cm' | 'cjk' | 'other'; text: string; boxes: TextWithBbox['bbox'][] }> = []
  const compact = (value: string) => value.normalize('NFKC').replace(/[\s\u3000\r\n]+/g, '')
  let index = 0
  while (index < ordered.length) {
    let matched = false
    for (let end = index; end < Math.min(ordered.length, index + 16); end++) {
      const candidate = compact(ordered.slice(index, end + 1).map((item) => item.text).join(''))
      if (candidate && CM_DIMENSION_RE.test(candidate)) {
        chunks.push({
          kind: 'cm',
          text: candidate.toLowerCase().replace(',', '.'),
          boxes: ordered.slice(index, end + 1).map((item) => item.bbox),
        })
        index = end + 1
        matched = true
        break
      }
    }
    if (matched) continue
    const item = ordered[index]
    const text = item.text.trim()
    if (text) {
      chunks.push({
        kind: CJK_RE.test(text) ? 'cjk' : 'other',
        text,
        boxes: [item.bbox],
      })
    }
    index += 1
  }
  const merged: typeof chunks = []
  for (const chunk of chunks) {
    const previous = merged.at(-1)
    if (previous && previous.kind === chunk.kind && (chunk.kind === 'cjk' || chunk.kind === 'cm')) {
      previous.text += chunk.text
      previous.boxes.push(...chunk.boxes)
    } else {
      merged.push(chunk)
    }
  }
  return merged
    .filter(
      (chunk) =>
        chunk.kind === 'cm' ||
        chunk.kind === 'cjk' ||
        CM_DIMENSION_RE.test(compact(chunk.text)) ||
        CJK_RE.test(chunk.text)
    )
    .map((chunk) => {
      const x1 = Math.min(...chunk.boxes.map((box) => box.x))
      const y1 = Math.min(...chunk.boxes.map((box) => box.y))
      const x2 = Math.max(...chunk.boxes.map((box) => box.x + box.width))
      const y2 = Math.max(...chunk.boxes.map((box) => box.y + box.height))
      return {
        text: chunk.text,
        bbox: { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) },
      }
    })
}

function extractFromBlock(block: BlockWithParagraphs, imgW: number, imgH: number): TextWithBbox[] {
  const out: TextWithBbox[] = []
  for (const p of block.paragraphs ?? []) {
    const words = p.words ?? []
    const paragraphText = words.map(getWordText).join('').trim()
    if (!paragraphText) continue
    const wordBlocks = extractWords(p, imgW, imgH)
    if (!wordBlocks.length) continue
    const hasCjk = CJK_RE.test(paragraphText)
    const hasCm = /\d+(?:[.,]\d+)?\s*cm(?!\w)/i.test(paragraphText.normalize('NFKC'))
    const confidence = p.confidence ?? block.confidence ?? 1
    if (!hasCjk && !hasCm && confidence < 0.15) continue
    const x1 = Math.min(...wordBlocks.map((word) => word.bbox.x))
    const y1 = Math.min(...wordBlocks.map((word) => word.bbox.y))
    const x2 = Math.max(...wordBlocks.map((word) => word.bbox.x + word.bbox.width))
    const y2 = Math.max(...wordBlocks.map((word) => word.bbox.y + word.bbox.height))
    const fallback = {
      text: paragraphText,
      bbox: { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) },
    }
    out.push(...splitParagraphCmCjk(words, paragraphText, fallback, imgW, imgH))
  }
  return out
}

export function visionDocumentBlocksToText(
  blocks: BlockWithParagraphs[],
  imgW: number,
  imgH: number
): TextWithBbox[] {
  return blocks.flatMap((block) => extractFromBlock(block, imgW, imgH))
}

/** Vision API: JSON request max 10MB, base64 ~+37% → giữ ảnh < 6MB để an toàn */
const MAX_OCR_BUFFER_BYTES = 6 * 1024 * 1024
/** Vision API OCR: giới hạn 20M pixels. Dùng 2048 để an toàn (4M pixels) tránh lỗi "Input image exceeds pixel limit" */
const MAX_OCR_DIMENSION = 2048
const MAX_OCR_PIXELS = 15_000_000

export interface DocumentOcrResult {
  results: TextWithBbox[]
  /** Khi resize: bbox trong results là pixel của ảnh đã resize. scale = kích thước resize / gốc. Để overlay lên ảnh gốc: bbox_goc = bbox / scale */
  scale: number
}

export type DocumentOcrOptions = {
  /** 188 ImageMerger gửi nguyên batch (đã chặn <=70MP), không thu toàn batch xuống 2048px. */
  preserveResolution?: boolean
}

/**
 * OCR ảnh tài liệu – trả về danh sách text kèm bounding box.
 * Dùng DOCUMENT_TEXT_DETECTION (chính xác hơn TEXT_DETECTION cho tài liệu).
 * Tự resize nếu ảnh quá lớn (tránh vượt giới hạn Vision API).
 */
export async function documentOcr(
  imageBuffer: Buffer,
  usage?: VisionUsageLog | null
): Promise<TextWithBbox[]> {
  const out = await documentOcrWithScale(imageBuffer, usage)
  return out.results
}

export async function documentOcrWithScale(
  imageBuffer: Buffer,
  usage?: VisionUsageLog | null,
  options?: DocumentOcrOptions
): Promise<DocumentOcrResult> {
  try {
  let buf = imageBuffer
  const meta = await sharp(buf, LARGE_IMAGE_INPUT).metadata()
  const origW = meta.width ?? 0
  const origH = meta.height ?? 0
  let imgW = origW
  let imgH = origH
  if (imgW <= 0 || imgH <= 0) return { results: [], scale: 1 }

  const pixels = imgW * imgH
  const scale = options?.preserveResolution
    ? 1
    : Math.min(
        buf.length > MAX_OCR_BUFFER_BYTES ? Math.sqrt(MAX_OCR_BUFFER_BYTES / buf.length) : 1,
        imgW > MAX_OCR_DIMENSION || imgH > MAX_OCR_DIMENSION ? MAX_OCR_DIMENSION / Math.max(imgW, imgH) : 1,
        pixels > MAX_OCR_PIXELS ? Math.sqrt(MAX_OCR_PIXELS / pixels) : 1,
        1
      )

  if (scale < 1) {
    const newW = Math.round(imgW * scale)
    const newH = Math.round(imgH * scale)
    buf = await sharp(buf, LARGE_IMAGE_INPUT).resize(newW, newH, { fit: 'inside' }).png().toBuffer()
    const m2 = await sharp(buf).metadata()
    imgW = m2.width ?? imgW
    imgH = m2.height ?? imgH
    console.log('[documentOcr] Resize ảnh để OCR:', imgW, 'x', imgH, '| buf:', Math.round(buf.length / 1024), 'KB')
  }

  const data = await visionAnnotate(
    buf,
    [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
    usage ?? null,
    { languageHints: ['zh', 'vi', 'en'] }
  ) as {
    responses?: Array<{
      fullTextAnnotation?: {
        pages?: Array<{ blocks?: Array<{ paragraphs?: unknown[] }> }>
      }
    }>
  }

  const full = data.responses?.[0]?.fullTextAnnotation
  const results: TextWithBbox[] = []
  for (const page of full?.pages ?? []) {
    results.push(...visionDocumentBlocksToText((page.blocks ?? []) as BlockWithParagraphs[], imgW, imgH))
  }
  if (!results.some((item) => CJK_RE.test(item.text))) {
    const fallbackData = await visionAnnotate(
      buf,
      [{ type: 'TEXT_DETECTION', maxResults: 100 }],
      usage ?? null,
      { languageHints: ['zh', 'vi', 'en'] }
    ) as {
      responses?: Array<{
        textAnnotations?: Array<{
          description?: string
          boundingPoly?: BoundingPoly
          bounding_poly?: BoundingPoly
        }>
      }>
    }
    const annotations = fallbackData.responses?.[0]?.textAnnotations ?? []
    for (const annotation of annotations.slice(1)) {
      const text = (annotation.description || '').trim()
      const vertices = (annotation.boundingPoly ?? annotation.bounding_poly)?.vertices
      if (!text || !CJK_RE.test(text) || !vertices?.length) continue
      const bbox = visionVerticesToPixelRect(vertices, imgW, imgH)
      const duplicate = results.some((existing) => {
        const left = Math.max(existing.bbox.x, bbox.x)
        const top = Math.max(existing.bbox.y, bbox.y)
        const right = Math.min(existing.bbox.x + existing.bbox.width, bbox.x + bbox.width)
        const bottom = Math.min(existing.bbox.y + existing.bbox.height, bbox.y + bbox.height)
        const intersection = Math.max(0, right - left) * Math.max(0, bottom - top)
        const union =
          existing.bbox.width * existing.bbox.height +
          bbox.width * bbox.height -
          intersection
        return union > 0 && intersection / union >= 0.88
      })
      if (!duplicate) results.push({ text, bbox })
    }
  }
  return { results, scale }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[documentOcr] LỖI:', msg)
    if (e instanceof Error) console.error('[documentOcr] stack:', e.stack)
    throw e instanceof Error ? e : new Error(msg)
  }
}

