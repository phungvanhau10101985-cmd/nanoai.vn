import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

function isMissingAllowAutoCreateColumn(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  if (code !== '42703') return false
  const msg = String((e as { message?: unknown }).message ?? '').toLowerCase()
  return msg.includes('allow_auto_create_categories')
}

/**
 * Mặc định true khi chưa có cột / chưa cấu hình DB — không làm hỏng shop đang chạy.
 */
export async function fetchPartnerAllowAutoCreateCategoriesFromPg(partnerId: string): Promise<boolean> {
  const pid = partnerId.trim()
  if (!pid || !isPgConfigured()) return true
  try {
    const row = await pgQueryOne<{ allow_auto_create_categories: boolean }>(
      `select allow_auto_create_categories
         from public.messaging_partners
        where id = $1::uuid
        limit 1`,
      [pid]
    )
    if (!row) return true
    return row.allow_auto_create_categories !== false
  } catch (e) {
    if (isMissingAllowAutoCreateColumn(e)) return true
    console.warn('[fetchPartnerAllowAutoCreateCategoriesFromPg]', e)
    return true
  }
}

export async function updatePartnerAllowAutoCreateCategoriesFromPg(
  partnerId: string,
  allow: boolean
): Promise<boolean | null> {
  const pid = partnerId.trim()
  if (!pid || !isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ allow_auto_create_categories: boolean }>(
      `update public.messaging_partners
          set allow_auto_create_categories = $2,
              updated_at = timezone('utc', now())
        where id = $1::uuid
      returning allow_auto_create_categories`,
      [pid, allow]
    )
    if (!row) return null
    return row.allow_auto_create_categories !== false
  } catch (e) {
    if (isMissingAllowAutoCreateColumn(e)) return null
    console.warn('[updatePartnerAllowAutoCreateCategoriesFromPg]', e)
    return null
  }
}
