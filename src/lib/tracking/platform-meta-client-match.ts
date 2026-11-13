import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import { isValidUuidString } from '@/lib/validate-uuid'

export type PlatformMetaClientMatch = {
  fbc: string
  fbp: string
  clientIp: string
  userAgent: string
}

const EMPTY: PlatformMetaClientMatch = { fbc: '', fbp: '', clientIp: '', userAgent: '' }

function cleanIp(raw: string | null | undefined): string {
  const ip = String(raw ?? '').trim()
  if (!ip || ip.length > 80) return ''
  if (!/^[\d.:a-fA-F]+$/.test(ip)) return ''
  return ip
}

/** Giữ click id cũ nếu lần này không có. IPv6 thắng IPv4 đã lưu. */
export function mergePlatformMetaClientMatch(
  prev: PlatformMetaClientMatch | null | undefined,
  next: {
    fbc?: string | null
    fbp?: string | null
    clientIp?: string | null
    userAgent?: string | null
  }
): PlatformMetaClientMatch {
  const prior = prev ?? EMPTY
  const fbc = normalizeMetaFbc(next.fbc) || prior.fbc
  const fbp = normalizeMetaFbp(next.fbp) || prior.fbp
  const incomingIp = cleanIp(next.clientIp)
  const clientIp = incomingIp.includes(':')
    ? incomingIp
    : prior.clientIp.includes(':')
      ? prior.clientIp
      : incomingIp || prior.clientIp
  const userAgent = String(next.userAgent ?? '').trim().slice(0, 512) || prior.userAgent
  return { fbc, fbp, clientIp, userAgent }
}

export async function loadPlatformMetaClientMatch(userId: string): Promise<PlatformMetaClientMatch | null> {
  const id = userId.trim()
  if (!isPgConfigured() || !isValidUuidString(id)) return null
  try {
    const row = await pgQueryOne<{
      fbc: string | null
      fbp: string | null
      client_ip: string | null
      user_agent: string | null
    }>(
      `select fbc, fbp, client_ip, user_agent
       from public.platform_meta_client_match
       where user_id = $1::uuid
       limit 1`,
      [id]
    )
    if (!row) return null
    return mergePlatformMetaClientMatch(null, {
      fbc: row.fbc,
      fbp: row.fbp,
      clientIp: row.client_ip,
      userAgent: row.user_agent,
    })
  } catch {
    return null
  }
}

export async function savePlatformMetaClientMatch(userId: string, match: PlatformMetaClientMatch): Promise<void> {
  const id = userId.trim()
  if (!isPgConfigured() || !isValidUuidString(id)) return
  if (!match.fbc && !match.fbp && !match.clientIp && !match.userAgent) return
  try {
    await pgQuery(
      `insert into public.platform_meta_client_match (user_id, fbc, fbp, client_ip, user_agent, updated_at)
       values ($1::uuid, nullif($2, ''), nullif($3, ''), nullif($4, ''), nullif($5, ''), now())
       on conflict (user_id) do update set
         fbc = excluded.fbc,
         fbp = excluded.fbp,
         client_ip = excluded.client_ip,
         user_agent = excluded.user_agent,
         updated_at = now()`,
      [id, match.fbc, match.fbp, match.clientIp, match.userAgent]
    )
  } catch {
    // Bảng chưa migrate thì Purchase vẫn gửi phần đang có trên request.
  }
}
