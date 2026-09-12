/** SLA vận hành đơn VN — chỉ badge, không tự hủy (UX 188). */

const VN_OFFSET = '+07:00'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function vnWallParts(value: Date): { y: number; m: number; d: number; hh: number; mm: number; ss: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(value)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || ''
  const weekdayName = pick('weekday')
  return {
    y: Number(pick('year')),
    m: Number(pick('month')),
    d: Number(pick('day')),
    hh: Number(pick('hour')),
    mm: Number(pick('minute')),
    ss: Number(pick('second')),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName),
  }
}

function vnDateTime(y: number, m: number, d: number, hh: number, mm = 0, ss = 0): Date {
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}${VN_OFFSET}`)
}

function addUtcDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() }
}

/** Số giờ 08:00–18:00, bỏ Chủ Nhật, theo giờ Việt Nam. */
export function vietnamBusinessHoursBetween(start: Date, end: Date): number {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return 0
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) return 0
  if (end.getTime() <= start.getTime()) return 0
  const startP = vnWallParts(start)
  const endP = vnWallParts(end)
  let total = 0
  let y = startP.y
  let m = startP.m
  let d = startP.d
  const lastKey = endP.y * 10000 + endP.m * 100 + endP.d
  while (y * 10000 + m * 100 + d <= lastKey) {
    const sample = vnDateTime(y, m, d, 12)
    const weekday = vnWallParts(sample).weekday
    if (weekday !== 0) {
      const opened = vnDateTime(y, m, d, 8)
      const closed = vnDateTime(y, m, d, 18)
      const left = new Date(Math.max(start.getTime(), opened.getTime()))
      const right = new Date(Math.min(end.getTime(), closed.getTime()))
      if (right.getTime() > left.getTime()) total += (right.getTime() - left.getTime()) / 3600_000
    }
    const next = addUtcDays(y, m, d, 1)
    y = next.y
    m = next.m
    d = next.d
  }
  return total
}

export function vietnamSlaBadge(input: {
  fulfillmentSource?: string | null
  activeStep?: string | null
  startedAt?: string | Date | null
  now?: Date
}): 'overdue_4h' | 'overdue_24h' | null {
  if (String(input.fulfillmentSource || 'vietnam').trim().toLowerCase() !== 'vietnam') return null
  const step = String(input.activeStep || '').trim()
  if (step !== 'vn_picking' && step !== 'vn_packed') return null
  const startedRaw = input.startedAt
  if (!startedRaw) return null
  const started = startedRaw instanceof Date ? startedRaw : new Date(startedRaw)
  if (Number.isNaN(started.getTime())) return null
  const now = input.now || new Date()
  const wallHours = (now.getTime() - started.getTime()) / 3600_000
  if (wallHours >= 24) return 'overdue_24h'
  if (step === 'vn_picking' && vietnamBusinessHoursBetween(started, now) >= 4) return 'overdue_4h'
  return null
}
