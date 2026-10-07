import * as XLSX from 'xlsx'
import type { WeddingInvitedGuestStatus } from '@/lib/db/wedding-cards-pg'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

export const WEDDING_GUEST_IMPORT_MAX_ROWS = 400
export const WEDDING_GUEST_IMPORT_MAX_BYTES = 1_500_000

const SAMPLE_NOTE = 'Dòng mẫu — xóa trước khi nhập'

const HEADER_ALIASES: Record<string, string[]> = {
  honorific: ['xung ho', 'danh xung', 'honorific'],
  name: ['ten', 'ho ten', 'ho va ten', 'name', 'guest', 'khach'],
  side: ['ben', 'nha', 'side', 'venue'],
  count: ['so nguoi', 'so khach', 'guest count', 'count', 'sl'],
  wish: ['loi chuc', 'wish', 'message'],
  notes: ['ghi chu', 'note', 'notes'],
  status: ['trang thai', 'status'],
}

export type WeddingGuestImportDraft = {
  rowNumber: number
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  guestCount: number
  wishMessage: string
  notes: string
  status: WeddingInvitedGuestStatus
}

export type WeddingGuestImportParseResult = {
  rows: WeddingGuestImportDraft[]
  skippedSample: number
  errors: string[]
}

function fold(value: string): string {
  return value
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cellText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function headerKey(label: string): keyof typeof HEADER_ALIASES | '' {
  const folded = fold(label)
  if (!folded) return ''
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof typeof HEADER_ALIASES, string[]]>) {
    if (aliases.some((alias) => folded === alias || folded.startsWith(`${alias} `))) return key
  }
  return ''
}

export function parseWeddingGuestSide(raw: string): WeddingGuestInviteVenue | '' {
  const folded = fold(raw)
  if (!folded) return ''
  if (
    folded === 'nha trai' ||
    folded === 'trai' ||
    folded === 'groom' ||
    folded === 'groom home' ||
    folded.includes('nha trai')
  ) {
    return 'groom_home'
  }
  if (
    folded === 'nha gai' ||
    folded === 'gai' ||
    folded === 'bride' ||
    folded === 'bride home' ||
    folded.includes('nha gai')
  ) {
    return 'bride_home'
  }
  return ''
}

export function parseWeddingGuestImportStatus(raw: string): WeddingInvitedGuestStatus | 'invalid' {
  const folded = fold(raw)
  if (!folded || folded === 'chua' || folded === 'pending' || folded === 'chua phan hoi') return 'pending'
  if (folded === 'co di' || folded === 'attending' || folded === 'di' || folded === 'co') return 'attending'
  if (folded === 'khong di' || folded === 'declined' || folded === 'khong') return 'declined'
  return 'invalid'
}

function parseCount(raw: string): number | null {
  if (!raw) return 1
  const n = Number(raw.replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < 0 || rounded > 40) return null
  return rounded
}

function isSampleNote(notes: string): boolean {
  return fold(notes).includes('dong mau')
}

export function parseWeddingGuestImportSheet(
  bytes: Buffer | Uint8Array,
  options?: { forceSide?: 'groom_home' | 'bride_home' },
): WeddingGuestImportParseResult | { error: string } {
  let matrix: unknown[][]
  try {
    const workbook = XLSX.read(bytes, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { error: 'File Excel không có sheet.' }
    matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][]
  } catch {
    return { error: 'Không đọc được file. Hãy dùng file .xlsx tải từ nút Tải file mẫu.' }
  }

  const forceSide = options?.forceSide
  let headerIndex = -1
  const columns: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}
  const scan = Math.min(matrix.length, 8)
  for (let i = 0; i < scan; i += 1) {
    const row = matrix[i] ?? []
    const found: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}
    row.forEach((cell, index) => {
      const key = headerKey(cellText(cell))
      if (key && found[key] == null) found[key] = index
    })
    const headerReady = forceSide ? found.name != null : found.name != null && found.side != null
    if (headerReady) {
      headerIndex = i
      Object.assign(columns, found)
      break
    }
  }
  if (headerIndex < 0 || columns.name == null || (!forceSide && columns.side == null)) {
    return {
      error: forceSide
        ? 'File thiếu cột Tên. Tải file mẫu của đúng nhà trai hoặc nhà gái rồi điền tên khách.'
        : 'File thiếu cột Tên hoặc Bên. Tải file mẫu rồi điền đúng các cột đó.',
    }
  }

  const rows: WeddingGuestImportDraft[] = []
  const errors: string[] = []
  let skippedSample = 0
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? []
    const read = (key: keyof typeof HEADER_ALIASES) => {
      const index = columns[key]
      return index == null ? '' : cellText(line[index])
    }
    const guestName = read('name')
    const sideRaw = read('side')
    const notes = read('notes').slice(0, 500)
    const honorific = read('honorific').slice(0, 80)
    const wish = read('wish').slice(0, 500)
    const statusRaw = read('status')
    const blank = !guestName && !sideRaw && !honorific && !wish && !notes && !statusRaw && !read('count')
    if (blank) continue
    if (isSampleNote(notes)) {
      skippedSample += 1
      continue
    }
    if (rows.length >= WEDDING_GUEST_IMPORT_MAX_ROWS) {
      errors.push(`Chỉ nhập tối đa ${WEDDING_GUEST_IMPORT_MAX_ROWS} khách mỗi lần.`)
      break
    }
    const rowNumber = i + 1
    if (!guestName) {
      errors.push(`Dòng ${rowNumber}: thiếu tên.`)
      continue
    }
    let inviteVenue = forceSide || parseWeddingGuestSide(sideRaw)
    if (forceSide && sideRaw) {
      const marked = parseWeddingGuestSide(sideRaw)
      if (marked && marked !== forceSide) {
        const here = forceSide === 'bride_home' ? 'nhà gái' : 'nhà trai'
        errors.push(`Dòng ${rowNumber}: cột Bên không phải ${here}, nên bỏ qua.`)
        continue
      }
      inviteVenue = forceSide
    }
    if (!inviteVenue) {
      errors.push(`Dòng ${rowNumber}: cột Bên phải là «Nhà trai» hoặc «Nhà gái».`)
      continue
    }
    const guestCount = parseCount(read('count'))
    if (guestCount == null) {
      errors.push(`Dòng ${rowNumber}: số người phải từ 0 đến 40.`)
      continue
    }
    const status = parseWeddingGuestImportStatus(statusRaw)
    if (status === 'invalid') {
      errors.push(`Dòng ${rowNumber}: trạng thái phải là Chưa, Có đi hoặc Không đi.`)
      continue
    }
    rows.push({
      rowNumber,
      guestHonorific: honorific,
      guestName: guestName.slice(0, 120),
      inviteVenue,
      guestCount,
      wishMessage: wish,
      notes,
      status,
    })
  }

  return { rows, skippedSample, errors: errors.slice(0, 8) }
}

export function buildWeddingGuestImportTemplate(side?: 'groom' | 'bride'): Buffer {
  const sideLabel = side === 'bride' ? 'Nhà gái' : side === 'groom' ? 'Nhà trai' : ''
  const headers = side
    ? ['Xưng hô', 'Tên', 'Số người', 'Lời chúc', 'Ghi chú', 'Trạng thái']
    : ['Xưng hô', 'Tên', 'Bên', 'Số người', 'Lời chúc', 'Ghi chú', 'Trạng thái']
  const sample = side
    ? ['Bạn', 'Đồng', 1, '', SAMPLE_NOTE, 'Chưa']
    : ['Bạn', 'Đồng', 'Nhà trai', 1, '', SAMPLE_NOTE, 'Chưa']
  const guide = [
    ['Cột', 'Cách điền'],
    ['Xưng hô', 'Bạn, Anh, Chị, Em, Cô, Chú, Ông, Bà… Có thể để trống.'],
    ['Tên', 'Bắt buộc. Không gồm xưng hô.'],
    ...(side
      ? [['Bên', `File này chỉ nhập khách ${sideLabel}. Mọi dòng hợp lệ vào đúng bên đó.`]]
      : [['Bên', 'Nhà trai hoặc Nhà gái.']]),
    ['Số người', '0–40. Để trống = 1.'],
    ['Lời chúc', 'Tuỳ chọn.'],
    ['Ghi chú', 'Tuỳ chọn. Dòng có chữ «Dòng mẫu» sẽ được bỏ qua khi import.'],
    ['Trạng thái', 'Chưa, Có đi, hoặc Không đi. Để trống = Chưa.'],
  ]
  const book = XLSX.utils.book_new()
  const data = XLSX.utils.aoa_to_sheet([headers, sample])
  data['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 36 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(book, data, 'Khach moi')
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(guide), 'Huong dan')
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
