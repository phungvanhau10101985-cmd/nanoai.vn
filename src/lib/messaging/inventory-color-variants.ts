/**
 * Cột `messaging_partner_inventory.stock_note` (file Excel: «Màu sắc (JSON)») —
 * mảng object { name, img } khi import chuẩn; cùng parser với form «Mua ngay».
 */
export type InventoryColorVariant = { name: string; img: string }

const MAX_VARIANTS = 30

/**
 * Parse JSON từ `stock_note` — bỏ qua nếu không phải mảng hợp lệ (ví dụ ghi chú tồn dạng chữ từ Open Catalog).
 */
export function parseColorVariantsJson(raw: string): InventoryColorVariant[] {
  const t = String(raw ?? '').trim()
  if (!t) return []
  if (t[0] !== '[') return []
  try {
    const arr = JSON.parse(t) as unknown
    if (!Array.isArray(arr)) return []
    const out: InventoryColorVariant[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      const img = typeof o.img === 'string' ? o.img.trim() : ''
      if (!name || !/^https?:\/\//i.test(img)) continue
      out.push({ name, img })
      if (out.length >= MAX_VARIANTS) break
    }
    return out
  } catch {
    return []
  }
}
