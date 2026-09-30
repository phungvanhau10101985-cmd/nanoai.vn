/**
 * Cột `id` của feed Meta / Google Merchant / TikTok.
 * `remarketing_id` nếu có, không thì `inventory.id`. Không dùng SKU, không dùng id đơn.
 */
export function catalogContentId(input: {
  remarketingId?: string | null
  inventoryId?: string | null
}): string {
  const remarketing = String(input.remarketingId ?? '').replace(/[\s\r\n]+/g, ' ').trim()
  const inventory = String(input.inventoryId ?? '').replace(/[\s\r\n]+/g, ' ').trim()
  const raw = remarketing || inventory
  return raw.length <= 100 ? raw : raw.slice(0, 100)
}
