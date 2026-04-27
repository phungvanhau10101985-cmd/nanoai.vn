/** Giới hạn tối đa kết quả tìm kho công khai (ảnh + chữ) — khớp pgvector / ANN. */
export const PARTNER_PUBLIC_INVENTORY_SEARCH_MAX = 50

/**
 * Số mặc hàng mặc định khi gọi API `image-search` / `text-search` mà không gửi `limit`.
 * `PARTNER_PUBLIC_INVENTORY_SEARCH_DEFAULT_LIMIT` (1–50), mặc định 24.
 * Alias: `PARTNER_IMAGE_SEARCH_DEFAULT_LIMIT` (tương thích tên cũ).
 */
export function getPartnerPublicInventorySearchDefaultLimit(): number {
  const raw =
    process.env.PARTNER_PUBLIC_INVENTORY_SEARCH_DEFAULT_LIMIT?.trim() ||
    process.env.PARTNER_IMAGE_SEARCH_DEFAULT_LIMIT?.trim()
  const fallback = 24
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, Math.max(1, n))
}
