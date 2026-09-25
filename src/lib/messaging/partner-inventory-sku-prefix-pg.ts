import { getPgPool } from '@/lib/db/pool'
import { assignShopSkuPrefixLetter } from '@/lib/messaging/partner-inventory-internal-sku'

type PrefixRow = {
  inventory_sku_prefix: string | null
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === '23505')
}

/**
 * Chữ hoa random, cố định của shop. Gán một lần, không đổi, không lấy từ tên shop.
 * Shop khác không nhận cùng chữ.
 */
export async function ensurePartnerInventorySkuPrefix(partnerId: string): Promise<string> {
  const pool = getPgPool()
  for (let attempt = 0; attempt < 5; attempt++) {
    const own = await pool.query<PrefixRow>(
      `select inventory_sku_prefix
       from public.messaging_partners
       where id = $1::uuid
       limit 1`,
      [partnerId]
    )
    const row = own.rows[0]
    if (!row) throw new Error('Không tìm thấy shop để cấp chữ cái SKU.')
    const saved = String(row.inventory_sku_prefix ?? '').trim().toUpperCase()
    if (/^[A-Z]$/.test(saved)) return saved

    const used = await pool.query<{ inventory_sku_prefix: string }>(
      `select inventory_sku_prefix
       from public.messaging_partners
       where id <> $1::uuid
         and inventory_sku_prefix is not null`,
      [partnerId]
    )
    const letter = assignShopSkuPrefixLetter(new Set(used.rows.map((item) => item.inventory_sku_prefix)))
    try {
      const updated = await pool.query<{ inventory_sku_prefix: string }>(
        `update public.messaging_partners
         set inventory_sku_prefix = $2
         where id = $1::uuid
           and inventory_sku_prefix is null
         returning inventory_sku_prefix`,
        [partnerId, letter]
      )
      const stored = String(updated.rows[0]?.inventory_sku_prefix ?? '').trim().toUpperCase()
      if (/^[A-Z]$/.test(stored)) return stored
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error
    }
  }
  throw new Error('Không khóa được chữ cái đầu SKU cho shop.')
}

/** Mã dạng 2 chữ + 4 số đang thuộc shop khác, cùng chữ đầu — không cấp lại. */
export async function listOtherShopInternalSkusForPrefix(partnerId: string, shopPrefix: string): Promise<string[]> {
  const prefix = shopPrefix.trim().toUpperCase()
  if (!/^[A-Z]$/.test(prefix)) return []
  const pool = getPgPool()
  const result = await pool.query<{ sku: string }>(
    `select btrim(sku) as sku
     from public.messaging_partner_inventory
     where partner_id <> $1::uuid
       and sku is not null
       and btrim(sku) ~ '^[A-Za-z]{2}[0-9]{4}$'
       and upper(left(btrim(sku), 1)) = $2`,
    [partnerId, prefix]
  )
  return result.rows.map((row) => row.sku).filter(Boolean)
}
