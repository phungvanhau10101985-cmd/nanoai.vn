/** Ngày ghi `language_coach_cache_daily_stats` — lịch Việt Nam, khớp bộ lọc thống kê admin. */
export function languageCoachCacheStatDayIct(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
