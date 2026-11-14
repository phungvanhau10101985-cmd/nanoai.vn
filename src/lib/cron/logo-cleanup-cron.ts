import {
  deleteExpiredInactiveLogoVersionsFromPg,
  listExpiredInactiveLogoVersionUrlsFromPg,
} from '@/lib/db/messaging-partner-logo-versions-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { removeTryOnStorageObjects, tryOnPublicUrlToStoragePath } from '@/lib/storage/try-on-public-upload'

export async function runLogoCleanupCron(): Promise<
  | { ok: true; retentionDays: number; candidates: number; deletedRows: number; deletedFiles: number }
  | { ok: false; error: string }
> {
  if (!isPgConfigured()) return { ok: false, error: 'DATABASE_URL not configured.' }
  const daysRaw = parseInt(process.env.MESSAGING_LOGO_UNUSED_DELETE_DAYS || '3', 10)
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, daysRaw)) : 3
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const urls = await listExpiredInactiveLogoVersionUrlsFromPg(cutoffIso)
  if (urls === null) return { ok: false, error: 'Failed to load expired logos.' }
  const paths = [...new Set(urls.map((u) => tryOnPublicUrlToStoragePath(u)).filter((p): p is string => Boolean(p)))]
  if (paths.length > 0) await removeTryOnStorageObjects(paths)
  const deleted = await deleteExpiredInactiveLogoVersionsFromPg(cutoffIso)
  if (deleted === null) return { ok: false, error: 'Failed to delete expired logo versions.' }
  return { ok: true, retentionDays: days, candidates: urls.length, deletedRows: deleted, deletedFiles: paths.length }
}
