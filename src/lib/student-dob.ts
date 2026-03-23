/** Ngày sinh học sinh: chọn ngày/tháng/năm → ISO YYYY-MM-DD (dùng tham gia lớp, làm bài thi). */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function buildDob(day: string, month: string, year: string): string {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return ''
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export function splitDob(input: string): { day: string; month: string; year: string } {
  if (!isValidStudentDobIso(input)) return { day: '', month: '', year: '' }
  const [year, month, day] = input.split('-')
  return {
    day: String(Number(day)),
    month: String(Number(month)),
    year,
  }
}

/** Khớp joinClass / lưu DB: YYYY-MM-DD, từ 1900 đến hôm nay (UTC). */
export function isValidStudentDobIso(iso: string): boolean {
  const s = String(iso ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return false
  if (d.getUTCFullYear() < 1900) return false
  if (d > new Date()) return false
  return true
}

export function formatDobDisplay(iso: string): string {
  if (!isValidStudentDobIso(iso)) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
