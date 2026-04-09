/**
 * Origin tuyệt đối cuối cùng (SEO, mail, cron) khi không suy ra được từ request.
 * Ưu tiên NEXT_PUBLIC_BASE_URL, rồi APP URLs, rồi Vercel preview, cuối cùng localhost.
 */
export function defaultPublicOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}
