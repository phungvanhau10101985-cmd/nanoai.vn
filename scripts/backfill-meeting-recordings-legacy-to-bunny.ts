/**
 * Copy object bucket `meeting-recordings` từ Storage REST nguồn (legacy) sang Bunny.
 * Cột `storage_path` trong DB không đổi; app đọc Bunny trước rồi fallback URL cũ nếu còn.
 *
 * DB: DATABASE_URL
 * Tải/xóa Storage REST legacy: STORAGE_LEGACY_* hoặc NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (fallback)
 * Bunny: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL
 *
 *   npx tsx scripts/backfill-meeting-recordings-legacy-to-bunny.ts
 *   npx tsx scripts/backfill-meeting-recordings-legacy-to-bunny.ts --apply
 *   npx tsx scripts/backfill-meeting-recordings-legacy-to-bunny.ts --apply --delete-source
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { pgQuery } from '../src/lib/db/pg-query'
import { MEETING_RECORDINGS_BUCKET } from '../src/lib/meeting-recording-config'
import { uploadMeetingRecordingToBunnyOnly } from '../src/lib/storage/meeting-recordings-storage'
import { getStorageLegacyRestConfig } from '../src/lib/storage/storage-legacy-rest-config'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const PAGE = 80

/** GET /storage/v1/object/{bucket}/{path} — fetch + service key (Storage REST legacy) */
async function downloadLegacyStorageObject(bucket: string, objectPath: string): Promise<Buffer | null> {
  const cfg = getStorageLegacyRestConfig()
  if (!cfg) return null
  const enc = objectPath
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
  const url = `${cfg.base}/storage/v1/object/${encodeURIComponent(bucket)}/${enc}`
  const res = await fetch(url, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  })
  if (!res.ok) {
    return null
  }
  return Buffer.from(await res.arrayBuffer())
}

async function deleteLegacyStorageObject(bucket: string, objectPath: string): Promise<boolean> {
  const cfg = getStorageLegacyRestConfig()
  if (!cfg) return false
  const enc = objectPath
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
  const url = `${cfg.base}/storage/v1/object/${encodeURIComponent(bucket)}/${enc}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  })
  return res.ok || res.status === 404
}

function parseArgs() {
  const apply = process.argv.includes('--apply')
  const deleteSource = process.argv.includes('--delete-source')
  return { apply, deleteSource }
}

async function main() {
  const { apply, deleteSource } = parseArgs()
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL.')
    process.exit(1)
  }
  if (!getStorageLegacyRestConfig()) {
    console.error(
      'Thiếu cấu hình Storage REST nguồn: STORAGE_LEGACY_REST_ORIGIN + STORAGE_LEGACY_SERVICE_KEY (hoặc NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).'
    )
    process.exit(1)
  }
  if (
    !process.env.BUNNY_STORAGE_ZONE?.trim() ||
    !process.env.BUNNY_STORAGE_API_KEY?.trim() ||
    !process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim()
  ) {
    console.error('Thiếu biến Bunny (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).')
    process.exit(1)
  }

  let offset = 0
  let copied = 0
  let skipped = 0
  let errors = 0

  for (;;) {
    const batch = await pgQuery<{ id: string; storage_path: string; mime_type: string }>(
      `select id, storage_path, mime_type from meeting_recordings order by created_at asc nulls last limit $1 offset $2`,
      [PAGE, offset]
    )

    if (batch.length === 0) break

    for (const row of batch) {
      const path = row.storage_path?.trim()
      if (!path) {
        skipped += 1
        continue
      }

      const buf = await downloadLegacyStorageObject(MEETING_RECORDINGS_BUCKET, path)
      if (!buf) {
        console.warn('[backfill] skip (no object on legacy storage)', row.id)
        skipped += 1
        continue
      }

      const mime =
        row.mime_type && row.mime_type.startsWith('audio/')
          ? row.mime_type.split(';')[0].trim()
          : 'audio/webm'

      if (!apply) {
        console.log('[dry-run] would copy', row.id, path, buf.length)
        copied += 1
        continue
      }

      try {
        await uploadMeetingRecordingToBunnyOnly(path, buf, mime)
        copied += 1
        if (deleteSource) {
          const ok = await deleteLegacyStorageObject(MEETING_RECORDINGS_BUCKET, path)
          if (!ok) console.warn('[backfill] legacy storage delete failed', path)
        }
      } catch (e) {
        errors += 1
        console.error('[backfill] Bunny upload', row.id, e)
      }
    }

    offset += batch.length
  }

  console.log(
    apply ? `Done. copied=${copied} skipped=${skipped} errors=${errors} deleteSource=${deleteSource}` : `Dry-run. would copy=${copied} skipped=${skipped}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
