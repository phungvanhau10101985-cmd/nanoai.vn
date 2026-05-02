/**
 * Thời hạn cookie phiên email & cookie phiên khách messaging (giây).
 * Tách file — an toàn khi import từ client boundary (không dùng `next/headers`).
 */
function resolveEmailSessionMaxAgeSec(): number {
  const raw = process.env.EMAIL_SESSION_MAX_AGE_DAYS?.trim()
  const days = raw ? parseInt(raw, 10) : 3650
  const d = Number.isFinite(days) ? Math.min(3650, Math.max(30, days)) : 3650
  return 60 * 60 * 24 * d
}

/** Mặc định ~10 năm; chỉnh `EMAIL_SESSION_MAX_AGE_DAYS` (30–3650). */
export const EMAIL_SESSION_MAX_AGE_SEC = resolveEmailSessionMaxAgeSec()
