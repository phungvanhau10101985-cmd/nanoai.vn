/** Trần trang PDF một lần chạy. Ảnh lẻ và Excel vẫn dùng trần riêng. */
export const MAX_PDF_PAGES = 500

/** Job đang chạy quá khoảng này thì được nhận lại. Trang đã xong không bị đụng. */
export const TRANSLATE_JOB_STALE_MS = 8 * 60 * 1000

export function pdfCheckpointObjectPath(userId: string, fileHash: string, zeroBasedIndex: number): string {
  const hash = fileHash.toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(hash)) throw new Error('Mã file PDF không hợp lệ.')
  if (!Number.isInteger(zeroBasedIndex) || zeroBasedIndex < 0 || zeroBasedIndex >= MAX_PDF_PAGES) {
    throw new Error('Số trang không hợp lệ.')
  }
  return `uploads/${userId}/pdf-checkpoint/${hash}/src_page_${zeroBasedIndex}.png`
}

export function pdfCheckpointLikePattern(fileHash: string): string {
  const hash = fileHash.toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(hash)) throw new Error('Mã file PDF không hợp lệ.')
  return `%/pdf-checkpoint/${hash}/src_page_%`
}

export type CheckpointRow = {
  historyId: string
  jobId: string | null
  batchId: string
  page: number
  historyStatus: string
  jobStatus: string | null
  hasResult: boolean
  createdAt: string
  /** Job processing còn trong hạn. Job processing quá hạn được xếp lại hàng chờ. */
  processingFresh: boolean
}

export type CheckpointPlan = {
  batchId: string | null
  skip: number[]
  keep: number[]
  requeue: Array<{ historyId: string; jobId: string | null; page: number }>
  create: number[]
}

function newest(rows: CheckpointRow[]): CheckpointRow {
  return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0]
}

/**
 * Trang đã có ảnh kết quả thì bỏ qua.
 * Trang đang dịch còn hạn thì để yên.
 * Trang lỗi, tạm dừng, đang chờ hoặc job chết thì xếp lại đúng trang đó.
 */
export function planPdfCheckpoint(selectedPages: number[], rows: CheckpointRow[]): CheckpointPlan {
  const byPage = new Map<number, CheckpointRow[]>()
  for (const row of rows) {
    if (!Number.isInteger(row.page) || row.page < 1) continue
    const list = byPage.get(row.page) ?? []
    list.push(row)
    byPage.set(row.page, list)
  }
  let batchId: string | null = null
  let newestAt = ''
  for (const row of rows) {
    if (row.createdAt >= newestAt && row.batchId) {
      newestAt = row.createdAt
      batchId = row.batchId
    }
  }
  const skip: number[] = []
  const keep: number[] = []
  const requeue: CheckpointPlan['requeue'] = []
  const create: number[] = []
  for (const page of selectedPages) {
    const list = byPage.get(page) ?? []
    if (list.some((row) => row.hasResult && row.historyStatus === 'completed')) {
      skip.push(page)
      continue
    }
    if (list.length === 0) {
      create.push(page)
      continue
    }
    const row = newest(list)
    if (row.jobStatus === 'processing' && row.processingFresh) {
      keep.push(page)
      continue
    }
    requeue.push({ historyId: row.historyId, jobId: row.jobId, page })
  }
  return { batchId, skip, keep, requeue, create }
}

export function finishedPdfPages(rows: Array<{ page: number; historyStatus: string; hasResult: boolean }>): number[] {
  return [...new Set(rows.filter((row) => row.hasResult && row.historyStatus === 'completed' && row.page > 0).map((row) => row.page))].sort(
    (a, b) => a - b
  )
}
