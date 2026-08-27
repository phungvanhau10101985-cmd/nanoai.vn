import * as XLSX from 'xlsx'
import {
  clampRating,
  coalesceImportGroup,
  sanitizeReviewImageUrls,
} from '@/lib/partner-website/reviews/partner-review-types'

/**
 * Excel đánh giá / hỏi đáp ảo — cùng cột 188.com.vn (EN + VI).
 * Import: inventory_id null, is_imported true, hiện theo import_group.
 */

export const REVIEW_EXCEL_COLUMNS = [
  'Tên người',
  'Số sao',
  'Tiêu đề',
  'Nội dung',
  'Tên người trả lời',
  'Nội dung trả lời',
  'Số đánh giá hữu ích',
  'Nhóm đánh giá',
  'Ảnh đánh giá',
] as const

const REVIEW_COLUMN_MAP: Record<string, string> = {
  user_name: 'user_name',
  'tên người': 'user_name',
  star: 'star',
  'số sao': 'star',
  title: 'title',
  'tiêu đề': 'title',
  content: 'content',
  'nội dung': 'content',
  reply_name: 'reply_name',
  'tên người trả lời': 'reply_name',
  reply_content: 'reply_content',
  'nội dung trả lời': 'reply_content',
  useful: 'useful',
  'số đánh giá hữu ích': 'useful',
  'số đánh gi': 'useful',
  group: 'group',
  'nhóm đánh giá': 'group',
  img_fake: 'images',
  'ảnh đánh giá': 'images',
}

export const QUESTION_EXCEL_COLUMNS = [
  'user_name',
  'content',
  'group',
  'useful',
  'reply_admin_name',
  'reply_admin_content',
  'reply_user_one_name',
  'reply_user_one_content',
  'reply_user_two_name',
  'reply_user_two_content',
] as const

const QUESTION_COLUMN_MAP: Record<string, string> = {
  user_name: 'user_name',
  'tên người hỏi': 'user_name',
  content: 'content',
  'nội dung': 'content',
  group: 'group',
  nhóm: 'group',
  useful: 'useful',
  'hữu ích': 'useful',
  reply_admin_name: 'reply_admin_name',
  'tên admin trả lời': 'reply_admin_name',
  reply_admin_content: 'reply_admin_content',
  'nội dung admin trả lời': 'reply_admin_content',
  reply_user_one_name: 'reply_user_one_name',
  'tên user 1 trả lời': 'reply_user_one_name',
  reply_user_one_conte: 'reply_user_one_content',
  reply_user_one_content: 'reply_user_one_content',
  'nội dung user 1 trả lời': 'reply_user_one_content',
  reply_user_two_name: 'reply_user_two_name',
  'tên user 2 trả lời': 'reply_user_two_name',
  reply_user_two_conte: 'reply_user_two_content',
  reply_user_two_content: 'reply_user_two_content',
  'nội dung user 2 trả lời': 'reply_user_two_content',
  reply_count: 'reply_count',
  'số câu trả lời (0=cho trả lời, 2=khóa)': 'reply_count',
  'số câu trả lời': 'reply_count',
}

export type ImportedReviewDraft = {
  reviewerName: string
  rating: number
  title: string
  content: string
  merchantReplyBy: string
  merchantReply: string
  usefulCount: number
  importGroup: number
  imageUrls: string[]
  createdAt: Date
}

export type ImportedQuestionDraft = {
  askerName: string
  content: string
  importGroup: number
  usefulCount: number
  createdAt: Date
  adminReplyName: string
  adminReplyContent: string
  buyerReplies: Array<{ name: string; content: string }>
}

function normalizeHeader(raw: string): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function cellInt(v: unknown, fallback: number): number {
  if (v == null || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

function randomDaysAgo(now: Date): Date {
  const days = 1 + Math.floor(Math.random() * 20)
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function parseImageUrls(raw: unknown): string[] {
  const text = cellText(raw)
  if (!text) return []
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const list = Array.isArray(parsed) ? parsed : [parsed]
  const urls = list
    .map((item) => {
      let url = String(item ?? '').trim()
      if (url.startsWith('//')) url = `https:${url}`
      return url
    })
    .filter(Boolean)
  return sanitizeReviewImageUrls(urls)
}

function readSheetRows(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
}

function mapRow(raw: Record<string, unknown>, columnMap: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const [col, value] of Object.entries(raw)) {
    const key = columnMap[normalizeHeader(col)]
    if (!key) continue
    data[key] = value
  }
  return data
}

export function parseReviewImportWorkbook(buffer: Buffer): ImportedReviewDraft[] {
  const now = new Date()
  const out: ImportedReviewDraft[] = []
  for (const raw of readSheetRows(buffer)) {
    const data = mapRow(raw, REVIEW_COLUMN_MAP)
    const content = cellText(data.content).slice(0, 4000)
    if (!content) continue
    out.push({
      reviewerName: cellText(data.user_name).slice(0, 200) || 'Import',
      rating: clampRating(cellInt(data.star, 5)),
      title: cellText(data.title).slice(0, 200),
      content,
      merchantReplyBy: cellText(data.reply_name).slice(0, 200),
      merchantReply: cellText(data.reply_content).slice(0, 2000),
      usefulCount: Math.max(0, cellInt(data.useful, 0)),
      importGroup: coalesceImportGroup(cellInt(data.group, 0)),
      imageUrls: parseImageUrls(data.images),
      createdAt: randomDaysAgo(now),
    })
  }
  return out
}

export function parseQuestionImportWorkbook(buffer: Buffer): ImportedQuestionDraft[] {
  const now = new Date()
  const out: ImportedQuestionDraft[] = []
  for (const raw of readSheetRows(buffer)) {
    const data = mapRow(raw, QUESTION_COLUMN_MAP)
    const content = cellText(data.content).slice(0, 1000)
    if (!content) continue
    const buyerReplies: Array<{ name: string; content: string }> = []
    const oneContent = cellText(data.reply_user_one_content).slice(0, 2000)
    if (oneContent) {
      buyerReplies.push({
        name: cellText(data.reply_user_one_name).slice(0, 200) || 'Khách',
        content: oneContent,
      })
    }
    const twoContent = cellText(data.reply_user_two_content).slice(0, 2000)
    if (twoContent && buyerReplies.length < 2) {
      buyerReplies.push({
        name: cellText(data.reply_user_two_name).slice(0, 200) || 'Khách',
        content: twoContent,
      })
    }
    out.push({
      askerName: cellText(data.user_name).slice(0, 200) || 'Import',
      content,
      importGroup: coalesceImportGroup(cellInt(data.group, 0)),
      usefulCount: Math.max(0, cellInt(data.useful, 0)),
      createdAt: randomDaysAgo(now),
      adminReplyName: cellText(data.reply_admin_name).slice(0, 200),
      adminReplyContent: cellText(data.reply_admin_content).slice(0, 2000),
      buyerReplies,
    })
  }
  return out
}

function writeSample(columns: readonly string[], row: Record<string, unknown>): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet([row], { header: [...columns] })
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildReviewImportSampleXlsx(): Buffer {
  return writeSample(REVIEW_EXCEL_COLUMNS, {
    'Tên người': 'Anh An',
    'Số sao': 4,
    'Tiêu đề': 'Hài lòng',
    'Nội dung': 'Sản phẩm đúng mô tả, giao nhanh.',
    'Tên người trả lời': 'Shop',
    'Nội dung trả lời': 'Cảm ơn bạn đã đánh giá.',
    'Số đánh giá hữu ích': 12,
    'Nhóm đánh giá': 1,
    'Ảnh đánh giá': '["https://example.com/img1.jpg"]',
  })
}

export function buildQuestionImportSampleXlsx(): Buffer {
  return writeSample(QUESTION_EXCEL_COLUMNS, {
    user_name: 'Nguyễn Văn A',
    content: 'Đặt hàng thì khoảng bao lâu nhận được hàng?',
    group: 0,
    useful: 3,
    reply_admin_name: 'Shop',
    reply_admin_content: 'Kho gửi khoảng 10-12 ngày anh nhận được hàng.',
    reply_user_one_name: 'Minh',
    reply_user_one_content: 'Mình nhận sau 11 ngày.',
    reply_user_two_name: '',
    reply_user_two_content: '',
  })
}
