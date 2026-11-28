/**
 * Kho shop SaaS: vector ảnh và tên chỉ tạo sau khi đã kiểm hàng giả sạch và bản địa hóa xong.
 * `localized` = đã xử lý. `skipped` = job đã xét và không còn ảnh để dịch.
 * pending / processing / failed / trống = chưa cho tạo vector.
 */
export function inventoryImageReadyForImageEmbedding(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim().toLowerCase()
  return value === 'localized' || value === 'skipped'
}

export function inventoryCounterfeitCleared(flag: unknown): boolean {
  if (!flag || typeof flag !== 'object' || Array.isArray(flag)) return false
  const row = flag as { checked?: unknown; risk?: unknown }
  const checked = row.checked === true || row.checked === 'true'
  const risk = row.risk === true || row.risk === 'true'
  return checked && !risk
}

export function inventoryReadyForVectors(input: {
  image_localization_status?: string | null
  counterfeit_risk?: unknown
}): boolean {
  return (
    inventoryImageReadyForImageEmbedding(input.image_localization_status) &&
    inventoryCounterfeitCleared(input.counterfeit_risk)
  )
}

/** SQL: đã kiểm sạch và đã bản địa hóa. `alias` rỗng = cột trần. */
export function inventoryVectorReadySql(alias = 'mpi'): string {
  const prefix = alias ? `${alias}.` : ''
  return `coalesce(${prefix}counterfeit_risk->>'checked', '') in ('true', 'True')
         and coalesce(${prefix}counterfeit_risk->>'risk', 'false') not in ('true', 'True')
         and ${inventoryImageEmbedLocalizedSql(alias)}`
}

export async function keepInventoryRowsReadyForVectors<T extends { id: string }>(
  partnerId: string,
  rows: T[]
): Promise<T[]> {
  if (!rows.length) return rows
  const { pgQuery } = await import('@/lib/db/pg-query')
  try {
    const ready = await pgQuery<{ id: string }>(
      `select id::text as id
       from public.messaging_partner_inventory
       where partner_id = $1::uuid
         and id = any($2::uuid[])
         and ${inventoryVectorReadySql('')}`,
      [partnerId, rows.map((row) => row.id)]
    )
    const ids = new Set(ready.map((row) => row.id))
    return rows.filter((row) => ids.has(row.id))
  } catch {
    return []
  }
}

/** Cùng điều kiện với inventoryImageReadyForImageEmbedding. `alias` rỗng = cột trần trong CTE. */
export function inventoryImageEmbedLocalizedSql(alias = 'mpi'): string {
  const col = alias ? `${alias}.image_localization_status` : 'image_localization_status'
  return `coalesce(nullif(trim(${col}), ''), 'pending') in ('localized', 'skipped')`
}
