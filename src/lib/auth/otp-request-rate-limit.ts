/**
 * Giới hạn gửi OTP: cooldown theo email (DB), số lần/giờ theo email (DB), số lần/giờ theo IP (bộ nhớ process).
 * PM2 fork 1 process: đủ; nhiều instance có thể lệch — cần store tập trung nếu muốn chặt hơn.
 */

import { pgQueryOne } from '@/lib/db/pg-query'

const ipTimestamps = new Map<string, number[]>()
const HOUR_MS = 60 * 60 * 1000

export function getOtpRequestClientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}

function pruneIpHits(ip: string, now: number): number[] {
  if (ip === 'unknown') return []
  const arr = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < HOUR_MS)
  if (arr.length === 0) ipTimestamps.delete(ip)
  else ipTimestamps.set(ip, arr)
  return arr
}

/** true = vượt giới hạn, cần từ chối (chưa ghi thêm hit). */
export function wouldExceedOtpIpLimit(ip: string, maxPerHour: number): boolean {
  if (maxPerHour <= 0) return false
  const now = Date.now()
  const arr = pruneIpHits(ip, now)
  return arr.length >= maxPerHour
}

/** Gọi sau khi gửi SMTP thành công. */
export function recordOtpIpHit(ip: string): void {
  if (ip === 'unknown') return
  const now = Date.now()
  const arr = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < HOUR_MS)
  arr.push(now)
  ipTimestamps.set(ip, arr)
}

/** true = đang trong thời gian chờ gửi lại (cooldown). */
export async function isInOtpResendCooldown(emailNormalized: string, cooldownSec: number): Promise<boolean> {
  if (cooldownSec <= 0) return false
  const row = await pgQueryOne<{ ok: boolean }>(
    `select exists(
       select 1 from public.nanoai_email_login_challenges
       where email_normalized = $1
         and created_at > now() - ($2::int * interval '1 second')
     ) as ok`,
    [emailNormalized, cooldownSec]
  )
  return row?.ok === true
}

export async function countOtpSendsForEmailLastHour(emailNormalized: string): Promise<number> {
  const row = await pgQueryOne<{ n: string }>(
    `select count(*)::text as n from public.nanoai_email_login_challenges
     where email_normalized = $1 and created_at > now() - interval '1 hour'`,
    [emailNormalized]
  )
  const n = row?.n != null ? parseInt(row.n, 10) : 0
  return Number.isFinite(n) ? n : 0
}
