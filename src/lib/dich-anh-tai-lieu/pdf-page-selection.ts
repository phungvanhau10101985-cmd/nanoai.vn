export type PdfPageSelectionError = 'empty' | 'format' | 'range'

/** Trang 1-based, đã sắp và bỏ trùng. Chuỗi rỗng là lỗi. `8-3` được hiểu là 3 đến 8. */
export function parsePdfPageSelection(
  input: string,
  pageCount: number
): { pages: number[] } | { error: PdfPageSelectionError } {
  const raw = input.trim()
  if (!raw || pageCount < 1) return { error: 'empty' }
  const pages = new Set<number>()
  const chunks = raw.split(/[,;]+/)
  for (const chunk of chunks) {
    const part = chunk.trim()
    if (!part) continue
    const range = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(part)
    if (range) {
      let start = Number(range[1])
      let end = Number(range[2])
      if (start > end) {
        const swap = start
        start = end
        end = swap
      }
      if (start < 1 || end > pageCount) return { error: 'range' }
      for (let page = start; page <= end; page++) pages.add(page)
      continue
    }
    if (/^\d+$/.test(part)) {
      const page = Number(part)
      if (page < 1 || page > pageCount) return { error: 'range' }
      pages.add(page)
      continue
    }
    return { error: 'format' }
  }
  if (pages.size === 0) return { error: 'empty' }
  return { pages: [...pages].sort((a, b) => a - b) }
}

export function allPdfPages(pageCount: number): number[] {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1)
}

/** `1,2,3,5,6` thành `1-3, 5-6`. */
export function formatPdfPageSelection(pages: number[]): string {
  const sorted = [...new Set(pages.filter((page) => page > 0))].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  const parts: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let index = 1; index <= sorted.length; index++) {
    const page = sorted[index]
    if (page === prev + 1) {
      prev = page
      continue
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`)
    start = page
    prev = page
  }
  return parts.join(', ')
}

/** Danh sách trang gửi lên để lấy ảnh xem trước. Bỏ trang lạ và lấy tối đa `max` trang. */
export function parseThumbPageList(raw: string, pageCount: number, max = 8): number[] {
  const pages = new Set<number>()
  for (const part of raw.split(',')) {
    const page = Number(part.trim())
    if (!Number.isInteger(page) || page < 1 || page > pageCount) continue
    pages.add(page)
    if (pages.size >= max) break
  }
  return [...pages].sort((a, b) => a - b)
}

/** Tên file upload dùng `_page_0` cho trang 1. */
export function pdfPageNumberFromUrl(url: string | null | undefined): number | null {
  const match = /_page_(\d+)\./.exec(url || '')
  if (!match) return null
  const zeroBased = Number(match[1])
  return Number.isFinite(zeroBased) ? zeroBased + 1 : null
}
