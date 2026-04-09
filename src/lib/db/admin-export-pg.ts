import type { PublicTableName } from '@/app/api/admin/export-data/public-tables'
import { PUBLIC_TABLES } from '@/app/api/admin/export-data/public-tables'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

function quotedTableIdent(table: PublicTableName): string {
  if (!PUBLIC_TABLES.includes(table)) {
    throw new Error(`Invalid export table: ${table}`)
  }
  return `"${table.replace(/"/g, '""')}"`
}

/** `select *` phân trang — chỉ `PublicTableName` đã whitelist. */
export async function fetchAllRowsFromPublicTablePaged(
  table: PublicTableName,
  pageSize: number
): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) {
    throw new Error('Chưa cấu hình DATABASE_URL.')
  }
  const ident = quotedTableIdent(table)
  const all: Record<string, unknown>[] = []
  let offset = 0
  const lim = Math.min(5000, Math.max(1, pageSize))
  while (true) {
    const rows = await pgQuery<Record<string, unknown>>(
      `select * from public.${ident} limit $1 offset $2`,
      [lim, offset]
    )
    all.push(...rows)
    if (rows.length < lim) break
    offset += lim
  }
  return all
}
