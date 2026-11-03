/** Đổi ngày dương ↔ âm lịch Việt Nam (múi +7), thuật toán Hồ Ngọc Đức. */

const TZ = 7
const PI = Math.PI

function floor(value: number): number {
  return Math.floor(value)
}

function jdFromDate(day: number, month: number, year: number): number {
  const a = floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  let jd = day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045
  if (jd < 2299161) {
    jd = day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - 32083
  }
  return jd
}

function jdToDate(jd: number): { year: number; month: number; day: number } {
  let b: number
  let c: number
  if (jd > 2299160) {
    const a = jd + 32044
    b = floor((4 * a + 3) / 146097)
    c = a - floor((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = floor((4 * c + 3) / 1461)
  const e = c - floor((1461 * d) / 4)
  const m = floor((5 * e + 2) / 153)
  return {
    day: e - floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * floor(m / 10),
    year: b * 100 + d - 4800 + floor(m / 10),
  }
}

function newMoonDay(k: number): number {
  const t = k / 1236.85
  const t2 = t * t
  const t3 = t2 * t
  const dr = PI / 180
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * dr)
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3
  let c1 = (0.1734 - 0.000393 * t) * Math.sin(m * dr) + 0.0021 * Math.sin(2 * dr * m)
  c1 = c1 - 0.4068 * Math.sin(mpr * dr) + 0.0161 * Math.sin(dr * 2 * mpr)
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * mpr)
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * f) - 0.0051 * Math.sin(dr * (m + mpr))
  c1 = c1 - 0.0074 * Math.sin(dr * (m - mpr)) + 0.0004 * Math.sin(dr * (2 * f + m))
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * f - m)) - 0.0006 * Math.sin(dr * (2 * f + mpr))
  c1 = c1 + 0.001 * Math.sin(dr * (2 * f - mpr)) + 0.0005 * Math.sin(dr * (2 * mpr + m))
  const delta =
    t < -11
      ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
      : -0.000278 + 0.000265 * t + 0.000262 * t2
  return floor(jd1 + c1 - delta + 0.5 + TZ / 24)
}

function sunLongitude(jdn: number): number {
  const t = (jdn - 2451545.5 - TZ / 24) / 36525
  const t2 = t * t
  const dr = PI / 180
  const m = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2
  let dl = (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(dr * m)
  dl = dl + (0.019993 - 0.000101 * t) * Math.sin(dr * 2 * m) + 0.00029 * Math.sin(dr * 3 * m)
  let longitude = (l0 + dl) * dr
  longitude = longitude - PI * 2 * floor(longitude / (PI * 2))
  return floor((longitude / PI) * 6)
}

function lunarMonth11(year: number): number {
  const off = jdFromDate(31, 12, year) - 2415021
  const k = floor(off / 29.530588853)
  let nm = newMoonDay(k)
  if (sunLongitude(nm) >= 9) nm = newMoonDay(k - 1)
  return nm
}

function leapMonthOffset(a11: number): number {
  const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0
  let i = 1
  let arc = sunLongitude(newMoonDay(k + i))
  while (true) {
    last = arc
    i += 1
    arc = sunLongitude(newMoonDay(k + i))
    if (arc === last || i >= 14) break
  }
  return i - 1
}

export function solarToLunar(input: {
  year: number
  month: number
  day: number
}): { day: number; month: number; year: number; leap: number } {
  const dayNumber = jdFromDate(input.day, input.month, input.year)
  const k = floor((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = newMoonDay(k + 1)
  if (monthStart > dayNumber) monthStart = newMoonDay(k)
  let a11 = lunarMonth11(input.year)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = input.year
    a11 = lunarMonth11(input.year - 1)
  } else {
    lunarYear = input.year + 1
    b11 = lunarMonth11(input.year + 1)
  }
  const lunarDay = dayNumber - monthStart + 1
  const diff = floor((monthStart - a11) / 29)
  let lunarLeap = 0
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const leapMonthDiff = leapMonthOffset(a11)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) lunarLeap = 1
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap }
}

export function lunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap = 0
): { year: number; month: number; day: number } | null {
  let a11: number
  let b11: number
  if (lunarMonth < 11) {
    a11 = lunarMonth11(lunarYear - 1)
    b11 = lunarMonth11(lunarYear)
  } else {
    a11 = lunarMonth11(lunarYear)
    b11 = lunarMonth11(lunarYear + 1)
  }
  const k = floor(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = lunarMonth - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) return null
    if (lunarLeap !== 0 || off >= leapOff) off += 1
  }
  const monthStart = newMoonDay(k + off)
  const solar = jdToDate(monthStart + lunarDay - 1)
  const check = solarToLunar(solar)
  if (
    check.day !== lunarDay ||
    check.month !== lunarMonth ||
    check.year !== lunarYear ||
    check.leap !== lunarLeap
  ) {
    return null
  }
  return solar
}
