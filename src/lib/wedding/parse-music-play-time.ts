/**
 * Parse nhập «30», «90.5», «1:30», «01:05:30» → giây (tối đa ~24h).
 */
export function parseWeddingMusicTimeToSeconds(raw: string): number | null {
  const v = raw.trim().slice(0, 40)
  if (!v) return null
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 86400) : null
  }
  const hhmmss = v.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/)
  if (hhmmss) {
    const h = Number(hhmmss[1])
    const m = Number(hhmmss[2])
    const sec = Number(hhmmss[3])
    if (![h, m, sec].every(Number.isFinite) || m >= 60 || sec >= 60) return null
    const total = h * 3600 + m * 60 + sec
    return total >= 0 ? Math.min(total, 86400) : null
  }
  const mmss = v.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (mmss) {
    const m = Number(mmss[1])
    const sec = Number(mmss[2])
    if (!Number.isFinite(m) || !Number.isFinite(sec) || sec >= 60) return null
    const total = m * 60 + sec
    return total >= 0 ? Math.min(total, 86400) : null
  }
  return null
}

/** Định dạng giây (ví dụ từ `HTMLMediaElement.currentTime`) → chuỗi tương thích `parseWeddingMusicTimeToSeconds`. */
export function formatWeddingMusicSecondsForInput(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0'
  let t = Math.round(seconds * 10) / 10
  t = Math.min(t, 86400)
  const m = Math.floor(t / 60)
  const s = Math.round((t - m * 60) * 10) / 10
  if (m === 0) {
    return Number.isInteger(s) ? String(s) : s.toFixed(1).replace(/\.0$/, '')
  }
  const secFormatted = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(1)
  return `${m}:${secFormatted}`
}
