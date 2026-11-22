import { isValidStudentDobIso } from '@/lib/student-dob'

export type RosterImportErrorCode = 'missing_code_column' | 'missing_code' | 'bad_code' | 'missing_name' | 'bad_birth'

export type RosterImportRow = {
  row: number
  sortNo: number | null
  name: string
  birthDate: string
  studentCode: string
}

export type RosterImportIssue = {
  row: number
  code: RosterImportErrorCode
}

const CODE_RE = /^[A-Z0-9]{4,32}$/

export function normalizeStudentCode(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

export function isStudentCode(code: string): boolean {
  return CODE_RE.test(code)
}

function foldHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function headerKind(cell: unknown): 'stt' | 'name' | 'birth' | 'code' | '' {
  const text = foldHeader(cell)
  if (!text) return ''
  if (text === 'stt' || text === 'so thu tu') return 'stt'
  if (text === 'ho ten' || text === 'ho va ten' || text === 'ten') return 'name'
  if (text === 'ngay sinh' || text === 'ngay thang nam sinh') return 'birth'
  if (text === 'ma dinh danh' || text === 'ma hs' || text === 'student code' || text === 'ma so') return 'code'
  return ''
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function rosterBirthToIso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
  }
  const text = String(value ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text)
  if (dmy) return `${dmy[3]}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`
  return ''
}

function cellText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function parseRosterMatrix(matrix: unknown[][]): {
  rows: RosterImportRow[]
  errors: RosterImportIssue[]
} {
  const errors: RosterImportIssue[] = []
  if (matrix.length === 0) return { rows: [], errors: [{ row: 1, code: 'missing_code_column' }] }
  const header = matrix[0] ?? []
  const index = { stt: -1, name: -1, birth: -1, code: -1 }
  header.forEach((cell, i) => {
    const kind = headerKind(cell)
    if (kind) index[kind] = i
  })
  if (index.code < 0) return { rows: [], errors: [{ row: 1, code: 'missing_code_column' }] }

  const byCode = new Map<string, RosterImportRow>()
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? []
    const row = i + 1
    const blank = [index.stt, index.name, index.birth, index.code].every((at) => at < 0 || cellText(line[at]) === '')
    if (blank) continue
    const studentCode = normalizeStudentCode(line[index.code])
    if (!studentCode) {
      errors.push({ row, code: 'missing_code' })
      continue
    }
    if (!isStudentCode(studentCode)) {
      errors.push({ row, code: 'bad_code' })
      continue
    }
    const name = cellText(index.name >= 0 ? line[index.name] : '')
    if (name.length < 2) {
      errors.push({ row, code: 'missing_name' })
      continue
    }
    const birthDate = rosterBirthToIso(index.birth >= 0 ? line[index.birth] : '')
    if (!isValidStudentDobIso(birthDate)) {
      errors.push({ row, code: 'bad_birth' })
      continue
    }
    const sortRaw = index.stt >= 0 ? Number(String(line[index.stt] ?? '').trim()) : NaN
    const sortNo = Number.isInteger(sortRaw) && sortRaw > 0 && sortRaw < 10000 ? sortRaw : null
    byCode.set(studentCode, { row, sortNo, name: name.slice(0, 120), birthDate, studentCode })
  }
  return { rows: [...byCode.values()], errors }
}

export function rosterTemplateRows(): string[][] {
  return [
    ['STT', 'Họ và tên', 'Ngày sinh', 'Mã định danh'],
    ['1', 'Nguyễn Văn An', '15/03/2012', 'HS0000000001'],
  ]
}
