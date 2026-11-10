/** Học phí lớp học thêm. Lịch tháng theo giờ Việt Nam (UTC+7). */

export const TUITION_AMOUNT_MIN = 1000
export const TUITION_AMOUNT_MAX = 100_000_000
export const TUITION_DAYS_MAX = 365
/** VietQR addInfo. Hiện đủ tên lớp + tên học sinh cạnh mã; QR giữ bản rút gọn. */
export const TRANSFER_CONTENT_MAX = 50

const VN_OFFSET_MS = 7 * 60 * 60 * 1000

export type TuitionPeriodStatus = 'not_due' | 'unpaid' | 'confirmed'

export type TuitionPeriodKind = 'partial' | 'full'

export type ClassTuitionPeriodView = {
  period: string
  label: string
  kind: TuitionPeriodKind
  status: TuitionPeriodStatus
  confirmedAt: string | null
  amount: number
  amountLabel: string
  dueOnLabel: string
  billableDays: number | null
  monthDays: number | null
}

export type ClassTuitionStudentView = {
  userId: string
  name: string
  dueOnLabel: string
  due: boolean
  locked: boolean
  transferContent: string
  qrImageUrl: string | null
  payPeriodLabel: string | null
  payAmountLabel: string | null
  payKind: TuitionPeriodKind | null
  payBillableDays: number | null
  payMonthDays: number | null
  unpaidCount: number
  periods: ClassTuitionPeriodView[]
}

export type ClassTuitionView = {
  monthlyVnd: number
  amountLabel: string
  dueAfterDays: number
  billingDay: number
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
  students: ClassTuitionStudentView[]
}

export type TutoringTuitionInput = {
  monthlyVnd: number
  dueAfterDays: number
  billingDay: number
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
}

export function vnYmd(date: Date): { y: number; m: number; d: number } {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  }
}

export function formatVnDate(date: Date): string {
  const { y, m, d } = vnYmd(date)
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${dd}/${mm}/${y}`
}

export function formatVnDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const min = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${formatVnDate(date)} ${hh}:${min}`
}

export function periodKeyFromDate(date: Date): string {
  const { y, m } = vnYmd(date)
  return `${y}-${String(m).padStart(2, '0')}`
}

export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split('-')
  if (!y || !m) return period
  return `${m}/${y}`
}

export function periodToDate(period: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null
  return `${period}-01`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function listPeriodsInclusive(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || from > to) return []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const out: string[] = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m === 13) {
      m = 1
      y += 1
    }
    if (out.length > 36) break
  }
  return out
}

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`
}

export function parseTuitionAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isSafeInteger(n)) return null
  if (n < TUITION_AMOUNT_MIN || n > TUITION_AMOUNT_MAX) return null
  return n
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function parseBillingDay(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d{1,2}$/.test(text)) return null
  const day = Number(text)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return day
}

/** Số ngày còn lại sau ngày vào lớp, trên tổng số ngày của tháng đó. */
export function firstTuitionShare(monthlyVnd: number, joinDay: number, monthDays: number): {
  billableDays: number
  amount: number
} {
  if (monthDays < 1 || monthlyVnd < 1) return { billableDays: 0, amount: 0 }
  const billableDays = Math.max(0, Math.min(monthDays, monthDays - joinDay))
  if (billableDays === 0) return { billableDays: 0, amount: 0 }
  return { billableDays, amount: Math.round((monthlyVnd * billableDays) / monthDays) }
}

export function parseDueDays(raw: string): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  if (!Number.isInteger(n) || n < 0 || n > TUITION_DAYS_MAX) return null
  return n
}

export function parseAccountNo(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '')
  if (!/^\d{6,20}$/.test(digits)) return null
  return digits
}

export function parseAccountName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 80) return null
  return name
}

export function parseBankBin(raw: string): string | null {
  const bin = raw.trim()
  if (!/^\d{6,8}$/.test(bin)) return null
  return bin
}

export function parseBankName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 1 || name.length > 80) return null
  return name
}

export function readTutoringTuitionFields(values: {
  amount: string
  days: string
  billingDay: string
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
}): TutoringTuitionInput | null {
  const monthlyVnd = parseTuitionAmount(values.amount)
  const dueAfterDays = parseDueDays(values.days)
  const billingDay = parseBillingDay(values.billingDay)
  const bankBin = parseBankBin(values.bankBin)
  const bankName = parseBankName(values.bankName)
  const accountNo = parseAccountNo(values.accountNo)
  const accountName = parseAccountName(values.accountName)
  if (
    monthlyVnd == null ||
    dueAfterDays == null ||
    billingDay == null ||
    !bankBin ||
    !bankName ||
    !accountNo ||
    !accountName
  ) {
    return null
  }
  return { monthlyVnd, dueAfterDays, billingDay, bankBin, bankName, accountNo, accountName }
}

export function buildTransferContent(className: string, studentName: string): string {
  const text = `${className} ${studentName}`.replace(/\s+/g, ' ').trim()
  if (text.length <= TRANSFER_CONTENT_MAX) return text
  return text.slice(0, TRANSFER_CONTENT_MAX).trim()
}

export function buildTuitionQrImageUrl(input: {
  bankBin: string
  accountNo: string
  accountName: string
  amount: number
  transferContent: string
}): string | null {
  const bank = input.bankBin.trim()
  const acc = input.accountNo.trim()
  const content = input.transferContent.trim()
  if (!bank || !acc || !content || input.amount < 1) return null
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(acc)}-compact2.png`
  const url = new URL(base)
  url.searchParams.set('amount', String(Math.round(input.amount)))
  url.searchParams.set('addInfo', content)
  if (input.accountName.trim()) url.searchParams.set('accountName', input.accountName.trim())
  return url.toString()
}

type VnYmd = { y: number; m: number; d: number }

function ymdStamp(ymd: VnYmd): number {
  return ymd.y * 10000 + ymd.m * 100 + ymd.d
}

function addCalendarDays(ymd: VnYmd, days: number): VnYmd {
  const utc = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days))
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() }
}

function formatYmd(ymd: VnYmd): string {
  return `${String(ymd.d).padStart(2, '0')}/${String(ymd.m).padStart(2, '0')}/${ymd.y}`
}

function monthStamp(y: number, m: number): number {
  return y * 12 + (m - 1)
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const index = monthStamp(y, m) + delta
  return { y: Math.floor(index / 12), m: (index % 12) + 1 }
}

function periodKey(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

type TuitionPeriodDraft = {
  period: string
  kind: TuitionPeriodKind
  amount: number
  dueOn: VnYmd
  billableDays: number | null
  monthDays: number | null
  status: TuitionPeriodStatus
  confirmedAt: string | null
}

/**
 * Lần đầu: ngày vào lớp + số ngày lịch, số tiền = học phí × (số ngày tháng − ngày vào) / số ngày tháng.
 * Từ tháng sau: đủ học phí vào ngày cô đặt. Đúng ngày hạn mà chưa xác nhận thì khóa lớp.
 */
export function tuitionPeriodsForStudent(input: {
  joinedAt: Date
  dueAfterDays: number
  billingDay: number
  monthlyVnd: number
  now: Date
  confirmedAtByPeriod: Map<string, string>
}): {
  dueOn: VnYmd
  due: boolean
  locked: boolean
  periods: TuitionPeriodDraft[]
} {
  const join = vnYmd(input.joinedAt)
  const today = vnYmd(input.now)
  const billingDay = Math.min(31, Math.max(1, Math.round(input.billingDay)))
  const monthDays = daysInMonth(join.y, join.m)
  const firstShare = firstTuitionShare(input.monthlyVnd, join.d, monthDays)
  const drafts: Omit<TuitionPeriodDraft, 'status' | 'confirmedAt'>[] = []

  if (firstShare.amount >= 1) {
    drafts.push({
      period: periodKey(join.y, join.m),
      kind: 'partial',
      amount: firstShare.amount,
      dueOn: addCalendarDays(join, Math.max(0, input.dueAfterDays)),
      billableDays: firstShare.billableDays,
      monthDays,
    })
  }

  let cursor = shiftMonth(join.y, join.m, 1)
  let guard = 0
  while (monthStamp(cursor.y, cursor.m) <= monthStamp(today.y, today.m) && guard < 36) {
    const dim = daysInMonth(cursor.y, cursor.m)
    drafts.push({
      period: periodKey(cursor.y, cursor.m),
      kind: 'full',
      amount: input.monthlyVnd,
      dueOn: { y: cursor.y, m: cursor.m, d: Math.min(billingDay, dim) },
      billableDays: null,
      monthDays: null,
    })
    cursor = shiftMonth(cursor.y, cursor.m, 1)
    guard += 1
  }

  const periods = drafts.map((draft) => {
    const confirmedAt = input.confirmedAtByPeriod.get(draft.period) ?? null
    const status: TuitionPeriodStatus = confirmedAt
      ? 'confirmed'
      : ymdStamp(today) >= ymdStamp(draft.dueOn)
        ? 'unpaid'
        : 'not_due'
    return { ...draft, status, confirmedAt }
  })

  const upcoming = shiftMonth(join.y, join.m, 1)
  const dueOn =
    periods[0]?.dueOn ?? {
      y: upcoming.y,
      m: upcoming.m,
      d: Math.min(billingDay, daysInMonth(upcoming.y, upcoming.m)),
    }
  const due = periods.some((period) => ymdStamp(today) >= ymdStamp(period.dueOn))
  const locked = periods.some((period) => period.status === 'unpaid')
  return { dueOn, due, locked, periods }
}

export function buildClassTuitionView(input: {
  monthlyVnd: number
  dueAfterDays: number
  billingDay: number
  bankBin: string
  bankName: string
  accountNo: string
  accountName: string
  className: string
  isOwner: boolean
  now: Date
  members: { userId: string; name: string; joinedAt: Date }[]
  confirmedAtByUser: Map<string, Map<string, string>>
}): ClassTuitionView {
  const students = input.members
    .map((member) => {
      const schedule = tuitionPeriodsForStudent({
        joinedAt: member.joinedAt,
        dueAfterDays: input.dueAfterDays,
        billingDay: input.billingDay,
        monthlyVnd: input.monthlyVnd,
        now: input.now,
        confirmedAtByPeriod: input.confirmedAtByUser.get(member.userId) ?? new Map(),
      })
      const periods: ClassTuitionPeriodView[] = schedule.periods.map((period) => ({
        period: period.period,
        label: formatPeriodLabel(period.period),
        kind: period.kind,
        status: period.status,
        confirmedAt: period.confirmedAt,
        amount: period.amount,
        amountLabel: formatVnd(period.amount),
        dueOnLabel: formatYmd(period.dueOn),
        billableDays: period.billableDays,
        monthDays: period.monthDays,
      }))
      const payTarget = periods.find((period) => period.status === 'unpaid') ?? periods.find((period) => period.status === 'not_due') ?? null
      const transferContent = buildTransferContent(input.className, member.name)
      const qrImageUrl =
        !input.isOwner && payTarget
          ? buildTuitionQrImageUrl({
              bankBin: input.bankBin,
              accountNo: input.accountNo,
              accountName: input.accountName,
              amount: payTarget.amount,
              transferContent,
            })
          : null
      return {
        userId: member.userId,
        name: member.name,
        dueOnLabel: payTarget?.dueOnLabel ?? formatYmd(schedule.dueOn),
        due: schedule.due,
        locked: schedule.locked,
        transferContent,
        qrImageUrl,
        payPeriodLabel: payTarget?.label ?? null,
        payAmountLabel: payTarget?.amountLabel ?? null,
        payKind: payTarget?.kind ?? null,
        payBillableDays: payTarget?.billableDays ?? null,
        payMonthDays: payTarget?.monthDays ?? null,
        unpaidCount: periods.filter((period) => period.status === 'unpaid').length,
        periods,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  return {
    monthlyVnd: input.monthlyVnd,
    amountLabel: formatVnd(input.monthlyVnd),
    dueAfterDays: input.dueAfterDays,
    billingDay: input.billingDay,
    bankBin: input.bankBin,
    bankName: input.bankName,
    accountNo: input.accountNo,
    accountName: input.accountName,
    students,
  }
}

export function periodAllowedForStudent(input: {
  period: string
  joinedAt: Date
  dueAfterDays: number
  billingDay: number
  monthlyVnd: number
  now: Date
}): boolean {
  const schedule = tuitionPeriodsForStudent({
    joinedAt: input.joinedAt,
    dueAfterDays: input.dueAfterDays,
    billingDay: input.billingDay,
    monthlyVnd: input.monthlyVnd,
    now: input.now,
    confirmedAtByPeriod: new Map(),
  })
  return schedule.periods.some((row) => row.period === input.period)
}
