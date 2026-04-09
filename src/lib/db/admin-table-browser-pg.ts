import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const ALLOWED_SCHEMAS = new Set(['public', 'auth'])

export type AdminTableInfo = {
  schema: string
  name: string
  /** Ước lượng từ pg_class.reltuples (có thể lệch thực tế) */
  rowEstimate: number | null
}

/**
 * Danh sách bảng (BASE TABLE) trong public + auth — dùng cho trình duyệt admin.
 */
export async function listAdminBaseTables(): Promise<AdminTableInfo[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ schema: string; name: string; row_estimate: string | null }>(
    `select t.table_schema as schema,
            t.table_name as name,
            coalesce(c.reltuples::bigint::text, null) as row_estimate
     from information_schema.tables t
     left join pg_namespace n on n.nspname = t.table_schema
     left join pg_class c on c.relnamespace = n.oid
       and c.relname = t.table_name
       and c.relkind = 'r'
     where t.table_type = 'BASE TABLE'
       and t.table_schema = any($1::text[])
     order by t.table_schema, t.table_name`,
    [['public', 'auth']]
  )
  return rows
    .filter((r) => ALLOWED_SCHEMAS.has(r.schema))
    .map((r) => {
      const rowEstimate =
        r.row_estimate != null && Number.isFinite(Number(r.row_estimate)) ? Number(r.row_estimate) : null
      return { schema: r.schema, name: r.name, rowEstimate }
    })
}

export async function adminTablePairExists(schema: string, name: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (!ALLOWED_SCHEMAS.has(schema)) return false
  const row = await pgQueryOne<{ ok: boolean }>(
    `select exists (
       select 1 from information_schema.tables t
       where t.table_schema = $1 and t.table_name = $2 and t.table_type = 'BASE TABLE'
     ) as ok`,
    [schema, name]
  )
  return row?.ok === true
}

const MAX_LIMIT = 200
const MAX_OFFSET = 500_000

export type AdminTablePageResult = {
  columns: string[]
  rows: Record<string, unknown>[]
  limit: number
  offset: number
}

/**
 * `SELECT *` một trang — chỉ sau khi `adminTablePairExists` = true.
 * Identifier dùng %I qua truy vấn động an toàn (không nối chuỗi từ client).
 */
export async function fetchAdminTablePage(
  schema: string,
  name: string,
  limit: number,
  offset: number
): Promise<AdminTablePageResult> {
  if (!isPgConfigured()) {
    throw new Error('Chưa cấu hình DATABASE_URL.')
  }
  const ok = await adminTablePairExists(schema, name)
  if (!ok) {
    throw new Error('Bảng không tồn tại hoặc không được phép xem.')
  }
  const lim = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)))
  const off = Math.min(MAX_OFFSET, Math.max(0, Math.floor(offset)))

  const meta = await pgQueryOne<{ cols: string[] }>(
    `select array_agg(a.attname::text order by a.attnum) as cols
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = $1::name and c.relname = $2::name
       and a.attnum > 0 and not a.attisdropped`,
    [schema, name]
  )
  const columns = meta?.cols?.length ? meta.cols : []

  const identSql = `select * from ${quoteIdent(schema)}.${quoteIdent(name)} limit $1 offset $2`
  const rows = await pgQuery<Record<string, unknown>>(identSql, [lim, off])

  return { columns, rows, limit: lim, offset: off }
}

function quoteIdent(ident: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(ident)) {
    throw new Error('Tên định danh không hợp lệ.')
  }
  return '"' + ident.replace(/"/g, '""') + '"'
}
