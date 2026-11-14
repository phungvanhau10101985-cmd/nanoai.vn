import { downloadTryOnObject, tryOnPublicUrlToStoragePath } from '@/lib/storage/try-on-public-upload'
import type { PdfPageKind } from '@/lib/dich-anh-tai-lieu/pdf-source'
import type { PdfTextLine } from '@/lib/dich-anh-tai-lieu/pdf-text-layout'

export type PdfPageMeta = {
  page: number
  widthPt: number
  heightPt: number
  kind: PdfPageKind
  keepTerms: string[]
  lines: PdfTextLine[]
  pagePdfPath: string | null
}

export type PdfLinesFile = {
  lines: string[]
  widthPt: number
  heightPt: number
}

export function metaPathForImagePath(imagePath: string): string | null {
  if (!/\.png$/i.test(imagePath)) return null
  return imagePath.replace(/\.png$/i, '.meta.json')
}

export function sidecarPath(imagePath: string, ext: '.lines.json' | '.pdf'): string | null {
  if (!/\.png$/i.test(imagePath)) return null
  return imagePath.replace(/\.png$/i, ext)
}

function isLine(value: unknown): value is PdfTextLine {
  if (!value || typeof value !== 'object') return false
  const line = value as PdfTextLine
  return typeof line.text === 'string' && [line.x, line.y, line.w, line.h].every((n) => typeof n === 'number')
}

export function parsePdfPageMeta(raw: string): PdfPageMeta | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PdfPageMeta>
    if (parsed.kind !== 'text' && parsed.kind !== 'scan') return null
    if (typeof parsed.page !== 'number' || typeof parsed.widthPt !== 'number' || typeof parsed.heightPt !== 'number') return null
    return {
      page: parsed.page,
      widthPt: parsed.widthPt,
      heightPt: parsed.heightPt,
      kind: parsed.kind,
      keepTerms: Array.isArray(parsed.keepTerms) ? parsed.keepTerms.filter((term) => typeof term === 'string') : [],
      lines: Array.isArray(parsed.lines) ? parsed.lines.filter(isLine) : [],
      pagePdfPath: typeof parsed.pagePdfPath === 'string' ? parsed.pagePdfPath : null,
    }
  } catch {
    return null
  }
}

export function parsePdfLinesFile(raw: string): PdfLinesFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PdfLinesFile>
    if (!Array.isArray(parsed.lines) || typeof parsed.widthPt !== 'number' || typeof parsed.heightPt !== 'number') return null
    return {
      lines: parsed.lines.filter((line) => typeof line === 'string'),
      widthPt: parsed.widthPt,
      heightPt: parsed.heightPt,
    }
  } catch {
    return null
  }
}

async function readStorageJson(path: string | null): Promise<string | null> {
  if (!path) return null
  try {
    const buffer = await downloadTryOnObject(path)
    return buffer ? buffer.toString('utf8') : null
  } catch {
    return null
  }
}

export async function loadPdfPageMeta(imageUrl: string): Promise<PdfPageMeta | null> {
  const imagePath = tryOnPublicUrlToStoragePath(imageUrl)
  const raw = await readStorageJson(metaPathForImagePath(imagePath || ''))
  return raw ? parsePdfPageMeta(raw) : null
}

export async function loadPdfLinesFile(imageUrl: string): Promise<PdfLinesFile | null> {
  const imagePath = tryOnPublicUrlToStoragePath(imageUrl)
  const raw = await readStorageJson(sidecarPath(imagePath || '', '.lines.json'))
  return raw ? parsePdfLinesFile(raw) : null
}

export async function loadPdfVectorPage(imageUrl: string): Promise<Buffer | null> {
  const imagePath = tryOnPublicUrlToStoragePath(imageUrl)
  const vectorPath = sidecarPath(imagePath || '', '.pdf')
  if (!vectorPath) return null
  try {
    return await downloadTryOnObject(vectorPath)
  } catch {
    return null
  }
}
