/**
 * Cờ môi trường tùy chọn (audit / middleware tự viết).
 * Ưu tiên `DIRECT_PG_FLAG` / `NEXT_PUBLIC_DIRECT_PG_FLAG`; vẫn đọc alias cũ `ZERO_*` (tương thích file env trước đây).
 */
function truthy(v: string | undefined): boolean {
  return v === '1' || v === 'true'
}

/** Server: DIRECT_PG_FLAG=1 hoặc ZERO_SUPABASE=1 (alias env cũ) */
export function isDirectPostgresFlagServer(): boolean {
  return truthy(process.env.DIRECT_PG_FLAG) || truthy(process.env.ZERO_SUPABASE)
}

/** Client: NEXT_PUBLIC_DIRECT_PG_FLAG=1 hoặc NEXT_PUBLIC_ZERO_SUPABASE=1 (alias env cũ) */
export function isDirectPostgresFlagBrowser(): boolean {
  return truthy(process.env.NEXT_PUBLIC_DIRECT_PG_FLAG) || truthy(process.env.NEXT_PUBLIC_ZERO_SUPABASE)
}
