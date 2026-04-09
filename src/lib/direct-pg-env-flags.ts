/**
 * Cờ môi trường tùy chọn (audit / middleware tự viết).
 * Server: `DIRECT_PG_FLAG`, `USE_DIRECT_PG`, `PG_DIRECT_STACK` (=1/true).
 * Client: `NEXT_PUBLIC_DIRECT_PG_FLAG`, `NEXT_PUBLIC_USE_DIRECT_PG`, `NEXT_PUBLIC_PG_DIRECT_STACK`.
 * Kế thừa file env cũ: `ZERO_SUPABASE`, `NEXT_PUBLIC_ZERO_SUPABASE`.
 */
function truthy(v: string | undefined): boolean {
  return v === '1' || v === 'true'
}

/** Server: bất kỳ cờ truthy trong nhóm direct-PG / PG stack */
export function isDirectPostgresFlagServer(): boolean {
  return (
    truthy(process.env.DIRECT_PG_FLAG) ||
    truthy(process.env.USE_DIRECT_PG) ||
    truthy(process.env.PG_DIRECT_STACK) ||
    truthy(process.env.ZERO_SUPABASE)
  )
}

/** Client: bất kỳ cờ truthy trong nhóm direct-PG / PG stack (public) */
export function isDirectPostgresFlagBrowser(): boolean {
  return (
    truthy(process.env.NEXT_PUBLIC_DIRECT_PG_FLAG) ||
    truthy(process.env.NEXT_PUBLIC_USE_DIRECT_PG) ||
    truthy(process.env.NEXT_PUBLIC_PG_DIRECT_STACK) ||
    truthy(process.env.NEXT_PUBLIC_ZERO_SUPABASE)
  )
}
