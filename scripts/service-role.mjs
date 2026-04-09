/**
 * @deprecated Script dùng `DATABASE_URL` + `scripts/pg-query.mjs`.
 * Stub để lỗi gọi nhầm có thông báo rõ (không import hosted JS client cũ).
 */
export function createServiceRoleClient() {
  throw new Error(
    '[direct-pg] Không còn createServiceRoleClient. Đặt DATABASE_URL trong .env.local và dùng scripts/pg-query.mjs (pgQuery / pgQueryRaw).'
  )
}

export function createServiceRoleClientFromUrl() {
  throw new Error(
    '[direct-pg] Không còn createServiceRoleClientFromUrl. Đặt DATABASE_URL trong .env.local và dùng scripts/pg-query.mjs (pgQuery / pgQueryRaw).'
  )
}
