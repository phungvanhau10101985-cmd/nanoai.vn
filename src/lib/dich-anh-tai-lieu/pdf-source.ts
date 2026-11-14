import fs from 'fs'
import os from 'os'
import path from 'path'
import { PDFDocument } from 'pdf-lib'
import { parsePopplerXhtmlLayout, type PdfTextLine } from '@/lib/dich-anh-tai-lieu/pdf-text-layout'

export type PdfPageKind = 'text' | 'scan'

export type PdfPageDescription = {
  widthPt: number
  heightPt: number
  kind: PdfPageKind
  lines: PdfTextLine[]
}

const TEXT_PAGE_MIN_CHARS = 80
const TEXT_PAGE_MAX_LINES = 180

async function createPoppler(): Promise<InstanceType<typeof import('node-poppler').Poppler>> {
  const { Poppler } = await import('node-poppler')
  if (process.platform === 'win32') {
    try {
      const dynamicRequire = Function('m', 'return require(m)') as (name: string) => unknown
      const win32ModuleName = ['node', 'poppler', 'win32'].join('-')
      const win32Path = dynamicRequire(win32ModuleName) as string
      if (win32Path && fs.existsSync(win32Path)) return new Poppler(win32Path)
    } catch {
      /* Poppler tự tìm */
    }
  }
  return new Poppler()
}

async function readPageSizes(pdfBuffer: Buffer): Promise<Array<{ widthPt: number; heightPt: number }>> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  return doc.getPages().map((page) => {
    const size = page.getSize()
    return { widthPt: size.width, heightPt: size.height }
  })
}

function letterCount(lines: PdfTextLine[]): number {
  return lines.reduce((total, line) => total + line.text.replace(/\s/g, '').length, 0)
}

/** Khổ trang từ PDF. kind text chỉ là nhãn trang có lớp chữ. Dịch vẫn gửi ảnh cho model vẽ lại. Poppler lỗi thì mọi trang là ảnh. */
export async function describePdfDocument(pdfBuffer: Buffer): Promise<PdfPageDescription[]> {
  const sizes = await readPageSizes(pdfBuffer)
  let layouts: PdfTextLine[][] = sizes.map(() => [])
  try {
    const poppler = await createPoppler()
    const xhtml = await poppler.pdfToText(pdfBuffer, undefined, { boundingBoxXhtmlLayout: true })
    const parsed = parsePopplerXhtmlLayout(String(xhtml || ''))
    layouts = sizes.map((_, index) => parsed[index]?.lines ?? [])
  } catch (error) {
    console.warn('[describePdfDocument] Không đọc được lớp chữ:', error instanceof Error ? error.message : error)
  }
  return sizes.map((size, index) => {
    const lines = layouts[index] ?? []
    const kind: PdfPageKind =
      lines.length > 0 && lines.length <= TEXT_PAGE_MAX_LINES && letterCount(lines) >= TEXT_PAGE_MIN_CHARS
        ? 'text'
        : 'scan'
    return {
      widthPt: size.widthPt,
      heightPt: size.heightPt,
      kind,
      lines: kind === 'text' ? lines : [],
    }
  })
}

/** Tách đúng các trang có lớp chữ thành PDF một trang, giữ vector. */
export async function splitPdfPages(pdfBuffer: Buffer, zeroBasedIndexes: number[]): Promise<Map<number, Buffer>> {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  const pages = new Map<number, Buffer>()
  for (const index of zeroBasedIndexes) {
    if (index < 0 || index >= src.getPageCount()) continue
    const doc = await PDFDocument.create()
    const [page] = await doc.copyPages(src, [index])
    doc.addPage(page)
    pages.set(index, Buffer.from(await doc.save()))
  }
  return pages
}

/** Giữ file PDF mở để tách từng trang rồi bỏ buffer, không giữ cả cuốn trong bộ nhớ. */
export async function loadPdfPageSplitter(pdfBuffer: Buffer): Promise<(zeroBasedIndex: number) => Promise<Buffer | null>> {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  return async (zeroBasedIndex: number) => {
    if (zeroBasedIndex < 0 || zeroBasedIndex >= src.getPageCount()) return null
    const doc = await PDFDocument.create()
    const [page] = await doc.copyPages(src, [zeroBasedIndex])
    doc.addPage(page)
    return Buffer.from(await doc.save())
  }
}

/** Ảnh xem trước của PDF một trang vừa vẽ chữ. */
export async function rasterizePdfFirstPage(pdfBuffer: Buffer): Promise<Buffer> {
  let tmpDir: string | null = null
  try {
    const poppler = await createPoppler()
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-text-'))
    const pdfPath = path.join(tmpDir, 'in.pdf')
    await fs.promises.writeFile(pdfPath, pdfBuffer)
    const outPrefix = path.join(tmpDir, 'page')
    await poppler.pdfToCairo(pdfPath, outPrefix, { pngFile: true, resolutionXYAxis: 144 })
    const entries = await fs.promises.readdir(tmpDir)
    const png = entries.find((name) => name.endsWith('.png'))
    if (!png) throw new Error('Poppler không tạo ảnh trang chữ.')
    return await fs.promises.readFile(path.join(tmpDir, png))
  } finally {
    if (tmpDir) fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
