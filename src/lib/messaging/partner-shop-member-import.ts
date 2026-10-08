import * as XLSX from 'xlsx'

export type ShopMemberImportRow = {
  rowNumber: number
  name: string
  gender: 'male' | 'female' | null
  email: string | null
  emailOriginal: string
  emailCorrected: boolean
  emailFixes: string[]
  birthday: string | null
  phone: string | null
  invalidReason: string | null
}

export type ShopMemberImportParse = {
  rows: ShopMemberImportRow[]
  totalInput: number
  invalidCount: number
  correctedCount: number
  duplicateInFile: number
}

const NAME_COLS = ['name', 'ten', 'họ tên', 'ho ten', 'hoten', 'full_name', 'fullname']
const GENDER_COLS = ['gender', 'gioi tinh', 'giới tính', 'gioitinh', 'sex']
const EMAIL_COLS = ['email', 'e-mail', 'e_mail', 'mail', 'email_address', 'dia_chi_email', 'địa chỉ email']
const BIRTHDAY_COLS = ['birthday', 'birth_date', 'date_of_birth', 'ngay sinh', 'ngày sinh', 'dob']
const PHONE_COLS = ['phone', 'mobile', 'sdt', 'sđt', 'dien thoai', 'điện thoại', 'tel']

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.co': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'iclould.com': 'icloud.com',
  'icloud.con': 'icloud.com',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normCol(name: unknown): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function pickColumn(headers: string[], aliases: string[]): string | null {
  for (const header of headers) {
    if (aliases.includes(header)) return header
  }
  for (const header of headers) {
    for (const alias of aliases) {
      if (header.includes(alias) || alias.includes(header)) return header
    }
  }
  return null
}

function cellStr(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value)
    if (value === Math.trunc(value)) return String(Math.trunc(value))
  }
  const text = String(value).trim()
  if (!text || text.toLowerCase() === 'nan' || text.toLowerCase() === 'none' || text.toLowerCase() === 'null') {
    return ''
  }
  return text.endsWith('.0') ? text.slice(0, -2) : text
}

function excelSerialToIso(serial: number): string | null {
  if (serial < 1 || serial > 150000) return null
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000
  const dt = new Date(ms)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10)
}

function parseBirthday(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToIso(value)
  }
  const text = cellStr(value)
  if (!text) return null
  if (/^\d+$/.test(text)) return excelSerialToIso(Number(text))
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${month}-${day}`
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function parseGender(raw: string): 'male' | 'female' | null {
  const low = raw.trim().toLowerCase()
  if (!low) return null
  if (low === 'nam' || low === 'male' || low === 'm') return 'male'
  if (low === 'nữ' || low === 'nu' || low === 'female' || low === 'f') return 'female'
  return null
}

function parsePhone(value: unknown): string | null {
  const text = cellStr(value)
  if (!text) return null
  let digits = text.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 9 && '35789'.includes(digits[0])) digits = `0${digits}`
  else if (digits.length === 11 && digits.startsWith('84')) digits = `0${digits.slice(2)}`
  else if (digits.length === 10 && digits.startsWith('84')) digits = `0${digits.slice(2)}`
  if (digits.length > 15) digits = digits.slice(0, 15)
  return digits
}

function fixEmail(raw: string): { email: string | null; fixes: string[]; reason: string | null } {
  let text = raw.trim().toLowerCase()
  const fixes: string[] = []
  if (!text || text === 'nan' || text === 'none' || text === 'null' || text === '-') {
    return { email: null, fixes, reason: null }
  }
  text = text.replace(/\s+/g, '').replace(/\u00a0/g, '')
  if (!text.includes('@') && text.includes(';')) {
    text = text.replace(';', '@')
    fixes.push('semicolon')
  }
  text = text.replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
  text = text
    .replace(/\.con$/i, '.com')
    .replace(/\.cmo$/i, '.com')
    .replace(/\.comn$/i, '.com')
    .replace(/\.comm$/i, '.com')
    .replace(/\.coom$/i, '.com')
    .replace(/\.conm$/i, '.com')
    .replace(/\.vnn$/i, '.vn')
  const at = text.lastIndexOf('@')
  if (at > 0) {
    const domain = text.slice(at + 1)
    const fixedDomain = DOMAIN_TYPOS[domain]
    if (fixedDomain) {
      text = `${text.slice(0, at + 1)}${fixedDomain}`
      fixes.push(domain)
    }
  }
  if (!EMAIL_RE.test(text)) {
    return { email: null, fixes, reason: 'Email không hợp lệ' }
  }
  return { email: text, fixes, reason: null }
}

export function parseShopMemberUpload(filename: string, content: Buffer): ShopMemberImportParse {
  const name = filename.toLowerCase()
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    throw new Error('Định dạng không hỗ trợ — dùng .csv, .xlsx hoặc .xls')
  }
  const book = XLSX.read(content, { type: 'buffer', cellDates: true })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  if (!sheet) throw new Error('File không có dòng dữ liệu.')
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  })
  if (matrix.length < 2) throw new Error('File không có dòng dữ liệu.')
  const headers = (matrix[0] ?? []).map((cell) => normCol(cell))
  const emailCol = pickColumn(headers, EMAIL_COLS)
  if (!emailCol) throw new Error('Không tìm thấy cột email trong file.')
  const nameCol = pickColumn(headers, NAME_COLS)
  const genderCol = pickColumn(headers, GENDER_COLS)
  const birthdayCol = pickColumn(headers, BIRTHDAY_COLS)
  const phoneCol = pickColumn(headers, PHONE_COLS)
  const indexOf = (col: string | null) => (col ? headers.indexOf(col) : -1)

  const rows: ShopMemberImportRow[] = []
  const seen = new Set<string>()
  let duplicateInFile = 0
  let invalidCount = 0
  let correctedCount = 0

  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i] ?? []
    if (line.every((cell) => cell == null || String(cell).trim() === '')) continue
    const original = cellStr(line[indexOf(emailCol)])
    const fixed = original ? fixEmail(original) : { email: null, fixes: [], reason: null }
    const phone = phoneCol ? parsePhone(line[indexOf(phoneCol)]) : null
    let invalidReason = fixed.reason
    let email = fixed.email
    if (email && seen.has(email)) {
      duplicateInFile += 1
      invalidReason = 'Trùng email trong file'
      email = null
    } else if (email) {
      seen.add(email)
    }
    if (!email && !phone && !invalidReason) invalidReason = 'Thiếu email hoặc SĐT'
    if (!email && phone && !invalidReason) invalidReason = 'Cần email để tạo tài khoản shop'
    if (invalidReason) invalidCount += 1
    if (email && fixed.fixes.length && original.toLowerCase() !== email) correctedCount += 1
    rows.push({
      rowNumber: i + 1,
      name: nameCol ? cellStr(line[indexOf(nameCol)]).slice(0, 180) : '',
      gender: genderCol ? parseGender(cellStr(line[indexOf(genderCol)])) : null,
      email,
      emailOriginal: original,
      emailCorrected: Boolean(email && original && original.toLowerCase() !== email),
      emailFixes: fixed.fixes,
      birthday: birthdayCol ? parseBirthday(line[indexOf(birthdayCol)]) : null,
      phone,
      invalidReason: email ? null : invalidReason,
    })
  }

  if (!rows.length) throw new Error('File không có dòng dữ liệu.')
  return { rows, totalInput: rows.length, invalidCount, correctedCount, duplicateInFile }
}
