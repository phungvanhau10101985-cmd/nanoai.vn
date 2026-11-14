import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { setTextRenderingMode, TextRenderingMode } from 'pdf-lib'
import type { PdfTextLine } from '@/lib/dich-anh-tai-lieu/pdf-text-layout'

type Rgb = { r: number; g: number; b: number }

let fontBytesPromise: Promise<Buffer> | null = null

function loadFontBytes(): Promise<Buffer> {
  if (!fontBytesPromise) {
    const fontPath = path.join(process.cwd(), 'src/lib/wedding/fonts/BeVietnamPro-Regular.ttf')
    fontBytesPromise = fs.promises.readFile(fontPath)
  }
  return fontBytesPromise
}

export async function embedDocumentFont(pdfDoc: PDFDocument): Promise<PDFFont> {
  const loaded = (await import('@pdf-lib/fontkit')) as { create?: unknown; default?: { create?: unknown } }
  const fontkit = typeof loaded.create === 'function' ? loaded : loaded.default
  if (!fontkit || typeof fontkit.create !== 'function') throw new Error('Không nạp được fontkit.')
  pdfDoc.registerFontkit(fontkit as Parameters<PDFDocument['registerFontkit']>[0])
  return pdfDoc.embedFont(await loadFontBytes(), { subset: true })
}

function drawable(font: PDFFont, text: string): string {
  let out = ''
  for (const char of text) {
    try {
      font.encodeText(char)
      out += char
    } catch {
      /* Bỏ ký tự font không có, giữ phần còn lại để vẫn copy được. */
    }
  }
  return out
}

async function sampleColor(png: Buffer | null, xPt: number, yPt: number, widthPt: number, heightPt: number): Promise<Rgb> {
  const fallback = { r: 1, g: 1, b: 1 }
  if (!png || widthPt <= 0 || heightPt <= 0) return fallback
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(png).metadata()
    const imageWidth = meta.width || 1
    const imageHeight = meta.height || 1
    const left = Math.min(imageWidth - 1, Math.max(0, Math.round((xPt / widthPt) * imageWidth)))
    const top = Math.min(imageHeight - 1, Math.max(0, Math.round((yPt / heightPt) * imageHeight)))
    const raw = await sharp(png).extract({ left, top, width: 1, height: 1 }).removeAlpha().raw().toBuffer()
    return { r: raw[0] / 255, g: raw[1] / 255, b: raw[2] / 255 }
  } catch {
    return fallback
  }
}

function contrast(color: Rgb) {
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  return luminance < 0.45 ? rgb(1, 1, 1) : rgb(0.12, 0.12, 0.14)
}

/**
 * Giữ trang vector, phủ từng dòng chữ gốc rồi vẽ câu đã dịch vào đúng ô.
 * `lines` dùng gốc trên-trái, đơn vị point.
 */
export async function rewritePdfPageText(input: {
  pagePdf: Buffer
  png: Buffer | null
  lines: PdfTextLine[]
  translated: string[]
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(input.pagePdf, { ignoreEncryption: true })
  const font = await embedDocumentFont(pdfDoc)
  const page = pdfDoc.getPage(0)
  const { width, height } = page.getSize()
  for (let index = 0; index < input.lines.length; index++) {
    const box = input.lines[index]
    const text = drawable(font, input.translated[index] || box.text)
    if (!text.trim() || box.w < 2 || box.h < 2) continue
    const pad = 1
    const pdfY = height - (box.y + box.h)
    const background = await sampleColor(input.png, box.x + 1, Math.max(0, box.y - 2), width, height)
    page.drawRectangle({
      x: box.x - pad,
      y: pdfY - pad,
      width: box.w + pad * 2,
      height: box.h + pad * 2,
      color: rgb(background.r, background.g, background.b),
    })
    let size = Math.min(Math.max(6, box.h * 0.72), 28)
    while (size > 5 && font.widthOfTextAtSize(text, size) > box.w) size -= 0.4
    page.drawText(text, {
      x: box.x,
      y: pdfY + Math.max(0, (box.h - size) * 0.22),
      size,
      font,
      color: contrast(background),
    })
  }
  return Buffer.from(await pdfDoc.save())
}

/** Lớp chữ ẩn để tìm và copy trên trang ảnh. Nền vẫn là ảnh đã dịch. */
export function drawInvisibleLines(page: PDFPage, font: PDFFont, lines: string[]): void {
  const height = page.getSize().height
  let y = height - 28
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible))
  for (const line of lines) {
    const text = drawable(font, line).slice(0, 500)
    if (!text.trim()) continue
    if (y < 24) break
    page.drawText(text, { x: 36, y, size: 9, font })
    y -= 11
  }
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill))
}

export type TranslatedPdfPageInput = {
  png: Buffer
  vectorPdf?: Buffer | null
  widthPt?: number
  heightPt?: number
  lines?: string[]
}

/** Ghép các trang đã dịch. Có PDF vector thì chép nguyên trang. Không thì dán ảnh đúng khổ và thêm lớp chữ. */
export async function buildPdfFromTranslatedPages(pages: TranslatedPdfPageInput[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const font = await embedDocumentFont(pdfDoc)
  const sharp = (await import('sharp')).default
  for (const pageInput of pages) {
    if (pageInput.vectorPdf && pageInput.vectorPdf.length > 0) {
      try {
        const src = await PDFDocument.load(pageInput.vectorPdf, { ignoreEncryption: true })
        const [copied] = await pdfDoc.copyPages(src, [0])
        pdfDoc.addPage(copied)
        continue
      } catch (error) {
        console.warn('[buildPdfFromTranslatedPages] Bỏ PDF vector, dùng ảnh:', error instanceof Error ? error.message : error)
      }
    }
    const png = await sharp(pageInput.png).png().toBuffer()
    const image = await pdfDoc.embedPng(png)
    const widthPt = pageInput.widthPt && pageInput.widthPt > 0 ? pageInput.widthPt : image.width
    const heightPt = pageInput.heightPt && pageInput.heightPt > 0 ? pageInput.heightPt : image.height
    const page = pdfDoc.addPage([widthPt, heightPt])
    const scale = Math.min(widthPt / image.width, heightPt / image.height)
    const drawWidth = image.width * scale
    const drawHeight = image.height * scale
    page.drawImage(image, {
      x: (widthPt - drawWidth) / 2,
      y: (heightPt - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
    if (pageInput.lines && pageInput.lines.length > 0) drawInvisibleLines(page, font, pageInput.lines)
  }
  return Buffer.from(await pdfDoc.save())
}
