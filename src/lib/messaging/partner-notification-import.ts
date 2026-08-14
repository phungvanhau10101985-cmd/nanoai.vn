import * as XLSX from 'xlsx'

export type PartnerNotificationImportRow = {
  rowNumber: number
  phone: string
  email: string
  title: string
  content: string
  scheduledAt: Date
}

const COLUMN_ALIASES: Record<string, 'phone' | 'email' | 'title' | 'content' | 'time_will_send'> = {
  phone: 'phone',
  'số điện thoại': 'phone',
  sodienthoai: 'phone',
  sdt: 'phone',
  email: 'email',
  'e-mail': 'email',
  title: 'title',
  'tiêu đề': 'title',
  tieude: 'title',
  content: 'content',
  'nội dung': 'content',
  noidung: 'content',
  time_will_send: 'time_will_send',
  'thời điểm sẽ gửi': 'time_will_send',
  'thời gian gửi': 'time_will_send',
  thoigian: 'time_will_send',
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

function normalizePhoneCell(raw: string): string {
  let phone = raw.trim()
  if (phone.endsWith('.0')) phone = phone.slice(0, -2)
  return phone
}

function parseScheduledAt(raw: string): Date | null {
  const s = raw.trim()
  if (!s || s.toLowerCase() === 'nan' || s.toLowerCase() === 'undefined') return null
  const excelSerial = Number(s)
  if (Number.isFinite(excelSerial) && excelSerial > 20000 && excelSerial < 80000 && !s.includes('/')) {
    const utc = Math.round((excelSerial - 25569) * 86400 * 1000)
    const d = new Date(utc)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const dayFirst = s.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  )
  if (dayFirst) {
    const day = Number(dayFirst[1])
    const month = Number(dayFirst[2])
    let year = Number(dayFirst[3])
    if (year < 100) year += 2000
    const hour = Number(dayFirst[4] ?? 0)
    const minute = Number(dayFirst[5] ?? 0)
    const second = Number(dayFirst[6] ?? 0)
    const d = new Date(year, month - 1, day, hour, minute, second)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parsePartnerNotificationImportFile(input: {
  filename: string
  buffer: Buffer
}): { rows: PartnerNotificationImportRow[]; error?: string } {
  const name = input.filename.trim().toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
    return { rows: [], error: 'invalid_file_format' }
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(input.buffer, { type: 'buffer', cellDates: true, raw: false })
  } catch {
    return { rows: [], error: 'read_file_failed' }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { rows: [], error: 'empty_sheet' }
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
  if (matrix.length < 2) return { rows: [], error: 'missing_columns' }

  const headerRow = (matrix[0] ?? []).map((h) => normalizeHeader(cellText(h)))
  const index: Partial<Record<'phone' | 'email' | 'title' | 'content' | 'time_will_send', number>> = {}
  headerRow.forEach((h, i) => {
    const key = COLUMN_ALIASES[h]
    if (key && index[key] == null) index[key] = i
  })

  if (index.phone == null || index.title == null || index.content == null || index.time_will_send == null) {
    return { rows: [], error: 'missing_columns' }
  }

  const rows: PartnerNotificationImportRow[] = []
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? []
    const phone = normalizePhoneCell(cellText(line[index.phone]))
    const email = index.email != null ? cellText(line[index.email]).toLowerCase() : ''
    const title = cellText(line[index.title])
    const content = cellText(line[index.content])
    const timeRaw = cellText(line[index.time_will_send])
    if (!phone && !email && !title && !content && !timeRaw) continue
    const scheduledAt = parseScheduledAt(timeRaw)
    rows.push({
      rowNumber: i + 1,
      phone,
      email,
      title,
      content,
      scheduledAt: scheduledAt ?? new Date(NaN),
    })
  }

  return { rows }
}

export function buildPartnerNotificationImportTemplateBuffer(): Buffer {
  const header = ['phone', 'title', 'content', 'time_will_send', 'email']
  const sample = ['0912345678', 'Ưu đãi tuần này', 'Shop gửi bạn mã giảm 10%.', '14/08/2026 09:00:00', '']
  const ws = XLSX.utils.aoa_to_sheet([header, sample])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'notifications')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
