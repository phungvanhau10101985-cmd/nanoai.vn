import { createHash, timingSafeEqual } from 'node:crypto'

const LOGIN_CODE_RE = /^[0-9]{6}$/

export function isStudentLoginCode(code: string): boolean {
  return LOGIN_CODE_RE.test(code)
}

/** Hộp thư giả, không gửi thư thật. Một mã định danh một tài khoản. */
export function studentEntryEmail(studentCode: string): string {
  return `hs.${studentCode.toLowerCase()}@hocsinh.invalid`
}

export function entryCodesMatch(stored: string, given: string): boolean {
  if (!isStudentLoginCode(stored) || !isStudentLoginCode(given)) return false
  const a = createHash('sha256').update(stored).digest()
  const b = createHash('sha256').update(given).digest()
  return timingSafeEqual(a, b)
}
