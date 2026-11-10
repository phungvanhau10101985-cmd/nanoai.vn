/**
 * Kho shop SaaS: vector ảnh chỉ tạo sau khi bản địa hóa ảnh xong.
 * `localized` = đã xử lý. `skipped` = job đã xét và không còn ảnh để dịch.
 * pending / processing / failed / trống = chưa cho đồng bộ Gemini.
 */
export function inventoryImageReadyForImageEmbedding(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim().toLowerCase()
  return value === 'localized' || value === 'skipped'
}

/** Cùng điều kiện với inventoryImageReadyForImageEmbedding. `alias` rỗng = cột trần trong CTE. */
export function inventoryImageEmbedLocalizedSql(alias = 'mpi'): string {
  const col = alias ? `${alias}.image_localization_status` : 'image_localization_status'
  return `coalesce(nullif(trim(${col}), ''), 'pending') in ('localized', 'skipped')`
}
