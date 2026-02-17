/**
 * Google Cloud Vision API – Document OCR.
 * Dùng cho hậu kiểm dịch ảnh tài liệu: phát hiện chữ còn sót (ngôn ngữ nguồn).
 * Vision API trả về tọa độ chuẩn hóa (0–1) → chuyển sang pixel.
 */

import sharp from 'sharp'
import { visionAnnotate } from './vision-api'

export interface TextWithBbox {
  text: string
  /** x, y, width, height (pixels) */
  bbox: { x: number; y: number; width: number; height: number }
}

interface Vertex { x?: number; y?: number }
interface BoundingPoly { vertices?: Vertex[] }

function verticesToRect(vertices: Vertex[]): { x: number; y: number; width: number; height: number } {
  const xs = vertices.map((v) => v.x ?? 0).filter((x) => x >= 0)
  const ys = vertices.map((v) => v.y ?? 0).filter((y) => y >= 0)
  if (xs.length === 0 || ys.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...xs) - x
  const height = Math.max(...ys) - y
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
    const norm = verticesToRect(verts)
    const bbox = {
      x: norm.x * imgW,
      y: norm.y * imgH,
      width: Math.max(1, norm.width * imgW),
      height: Math.max(1, norm.height * imgH),
    }
    if (bbox.width > 0 && bbox.height > 0) {
      out.push({ text, bbox })
    }
  }
  return out
}

interface BlockWithParagraphs {
  paragraphs?: Array<{
    words?: Array<{
      symbols?: Array<{ text?: string }>
      text?: unknown
      boundingBox?: BoundingPoly
      bounding_box?: BoundingPoly
    }>
  }>
}

function extractFromBlock(block: BlockWithParagraphs, imgW: number, imgH: number): TextWithBbox[] {
  const out: TextWithBbox[] = []
  for (const p of block.paragraphs ?? []) {
    out.push(...extractWords(p, imgW, imgH))
  }
  return out
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

/**
 * OCR ảnh tài liệu – trả về danh sách text kèm bounding box.
 * Dùng DOCUMENT_TEXT_DETECTION (chính xác hơn TEXT_DETECTION cho tài liệu).
 * Tự resize nếu ảnh quá lớn (tránh vượt giới hạn Vision API).
 */
export async function documentOcr(imageBuffer: Buffer): Promise<TextWithBbox[]> {
  const out = await documentOcrWithScale(imageBuffer)
  return out.results
}

export async function documentOcrWithScale(imageBuffer: Buffer): Promise<DocumentOcrResult> {
  try {
  let buf = imageBuffer
  const meta = await sharp(buf).metadata()
  const origW = meta.width ?? 0
  const origH = meta.height ?? 0
  let imgW = origW
  let imgH = origH
  if (imgW <= 0 || imgH <= 0) return { results: [], scale: 1 }

  const pixels = imgW * imgH
  const scale = Math.min(
    buf.length > MAX_OCR_BUFFER_BYTES ? Math.sqrt(MAX_OCR_BUFFER_BYTES / buf.length) : 1,
    imgW > MAX_OCR_DIMENSION || imgH > MAX_OCR_DIMENSION ? MAX_OCR_DIMENSION / Math.max(imgW, imgH) : 1,
    pixels > MAX_OCR_PIXELS ? Math.sqrt(MAX_OCR_PIXELS / pixels) : 1,
    1
  )

  if (scale < 1) {
    const newW = Math.round(imgW * scale)
    const newH = Math.round(imgH * scale)
    buf = await sharp(buf).resize(newW, newH, { fit: 'inside' }).png().toBuffer()
    const m2 = await sharp(buf).metadata()
    imgW = m2.width ?? imgW
    imgH = m2.height ?? imgH
    console.log('[documentOcr] Resize ảnh để OCR:', imgW, 'x', imgH, '| buf:', Math.round(buf.length / 1024), 'KB')
  }

  const data = await visionAnnotate(buf, [
    { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
  ]) as {
    responses?: Array<{
      fullTextAnnotation?: {
        pages?: Array<{ blocks?: Array<{ paragraphs?: unknown[] }> }>
      }
    }>
  }

  const full = data.responses?.[0]?.fullTextAnnotation
  if (!full?.pages?.length) return { results: [], scale }

  const results: TextWithBbox[] = []
  for (const page of full.pages) {
    for (const block of page.blocks ?? []) {
      results.push(...extractFromBlock(block, imgW, imgH))
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

