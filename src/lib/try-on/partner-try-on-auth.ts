import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function hashPartnerTryOnSecret(secret: string): string {
  return createHash('sha256').update(secret.trim(), 'utf8').digest('hex')
}

export async function resolvePartnerTryOnBillingUserId(
  adminSupabase: SupabaseClient,
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
  const { data, error } = await adminSupabase
    .from('partner_try_on_clients')
    .select('billing_user_id, is_active')
    .eq('key_hash', keyHash)
    .maybeSingle()
  if (error) {
    console.error('[partner try-on] key lookup', error)
    return { error: 'Unauthorized.', status: 401 }
  }
  if (!data?.billing_user_id || data.is_active === false) {
    return { error: 'Invalid or inactive API key.', status: 401 }
  }
  return { billingUserId: data.billing_user_id }
}
