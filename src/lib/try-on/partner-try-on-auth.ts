import { createHash } from 'node:crypto'
import { findPartnerTryOnBillingUserIdByKeyHashPg } from '@/lib/db/partner-try-on-pg'
import { isPgConfigured } from '@/lib/db/pool'

export function hashPartnerTryOnSecret(secret: string): string {
  return createHash('sha256').update(secret.trim(), 'utf8').digest('hex')
}

export async function resolvePartnerTryOnBillingUserId(
  authorizationHeader: string | null
): Promise<{ billingUserId: string } | { error: string; status: number }> {
  const trimmed = authorizationHeader?.trim() ?? ''
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(trimmed)
  if (!bearerMatch) {
    return { error: 'Missing or invalid Authorization header (expected Bearer).', status: 401 }
  }
  const secret = bearerMatch[1].trim()
  if (!secret) {
    return { error: 'Missing API key.', status: 401 }
  }
  const keyHash = hashPartnerTryOnSecret(secret)

  if (!isPgConfigured()) {
    return { error: 'Server database is not configured.', status: 503 }
  }

  const row = await findPartnerTryOnBillingUserIdByKeyHashPg(keyHash)
  if (!row?.billingUserId) {
    return { error: 'Invalid or inactive API key.', status: 401 }
  }
  return { billingUserId: row.billingUserId }
}
