/** Keep one live website; edit history is session snapshots that expire after 7 days. */

export const PARTNER_WEBSITE_REVISION_RETENTION_DAYS = 7
export const PARTNER_WEBSITE_REVISION_SESSION_MS = 30 * 60 * 1000

const NEVER_COALESCE_NOTES = new Set(['before_restore'])

export function revisionRetentionCutoffMs(
  nowMs = Date.now(),
  retentionDays = PARTNER_WEBSITE_REVISION_RETENTION_DAYS
): number {
  return nowMs - retentionDays * 24 * 60 * 60 * 1000
}

export function isRevisionExpired(
  createdAtIso: string,
  nowMs = Date.now(),
  retentionDays = PARTNER_WEBSITE_REVISION_RETENTION_DAYS
): boolean {
  const created = Date.parse(createdAtIso)
  if (!Number.isFinite(created)) return true
  return created < revisionRetentionCutoffMs(nowMs, retentionDays)
}

export function revisionDaysRemaining(
  createdAtIso: string,
  nowMs = Date.now(),
  retentionDays = PARTNER_WEBSITE_REVISION_RETENTION_DAYS
): number {
  const created = Date.parse(createdAtIso)
  if (!Number.isFinite(created)) return 0
  const expiresAt = created + retentionDays * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((expiresAt - nowMs) / (24 * 60 * 60 * 1000)))
}

/**
 * One snapshot per editing session of the same kind (theme, brand…).
 * The first save already captured the pre-session site — extra saves in the
 * window must not create duplicate copies.
 */
export function shouldCoalesceRevisionSession(input: {
  lastChangeNote: string | null | undefined
  lastCreatedAtIso: string | null | undefined
  nextChangeNote: string | null | undefined
  nowMs?: number
  sessionMs?: number
}): boolean {
  const next = input.nextChangeNote?.trim() || ''
  const last = input.lastChangeNote?.trim() || ''
  if (!next || !last || next !== last) return false
  if (NEVER_COALESCE_NOTES.has(next)) return false
  const lastCreated = Date.parse(input.lastCreatedAtIso ?? '')
  if (!Number.isFinite(lastCreated)) return false
  const now = input.nowMs ?? Date.now()
  const windowMs = input.sessionMs ?? PARTNER_WEBSITE_REVISION_SESSION_MS
  return now - lastCreated < windowMs
}
