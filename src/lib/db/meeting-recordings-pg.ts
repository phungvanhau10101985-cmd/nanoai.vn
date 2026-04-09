import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MeetingRecordingRowPg = {
  id: string
  user_id: string
  title: string
  storage_path: string
  duration_seconds: number
  mime_type: string
  file_size_bytes: number
}

export async function insertMeetingRecordingPg(input: {
  id: string
  userId: string
  title: string
  storagePath: string
  durationSeconds: number
  mimeType: string
  fileSizeBytes: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `insert into public.meeting_recordings (
         id, user_id, title, storage_path, duration_seconds, mime_type, file_size_bytes
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`,
      [
        input.id,
        input.userId,
        input.title,
        input.storagePath,
        input.durationSeconds,
        input.mimeType,
        input.fileSizeBytes,
      ]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[meeting-recordings-pg] insertMeetingRecordingPg', e)
    return false
  }
}

export async function fetchMeetingRecordingForUserPg(
  recordingId: string,
  userId: string
): Promise<MeetingRecordingRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      user_id: string
      title: string
      storage_path: string
      duration_seconds: string | number
      mime_type: string
      file_size_bytes: string | number
    }>(
      `select id::text, user_id::text, title, storage_path, duration_seconds, mime_type, file_size_bytes
       from public.meeting_recordings
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [recordingId, userId]
    )
    if (!row) return null
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title ?? '',
      storage_path: row.storage_path,
      duration_seconds: Number(row.duration_seconds),
      mime_type: row.mime_type,
      file_size_bytes: Number(row.file_size_bytes),
    }
  } catch (e) {
    console.error('[meeting-recordings-pg] fetchMeetingRecordingForUserPg', e)
    return null
  }
}

export async function updateMeetingRecordingTitlePg(
  recordingId: string,
  userId: string,
  title: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.meeting_recordings
       set title = $3
       where id = $1::uuid and user_id = $2::uuid`,
      [recordingId, userId, title.slice(0, 200)]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[meeting-recordings-pg] updateMeetingRecordingTitlePg', e)
    return false
  }
}

/** Đường dẫn logic (userId/uuid.ext) — dùng trước khi xóa file Bunny. */
export async function listMeetingRecordingStoragePathsBeforeCutoffPg(cutoffIso: string): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ storage_path: string }>(
      `select storage_path from public.meeting_recordings where created_at < $1::timestamptz`,
      [cutoffIso]
    )
    return rows.map((r) => r.storage_path).filter(Boolean)
  } catch (e) {
    console.error('[meeting-recordings-pg] listMeetingRecordingStoragePathsBeforeCutoffPg', e)
    return []
  }
}

export async function deleteMeetingRecordingsBeforeCutoffPg(cutoffIso: string): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const pool = getPgPool()
    const res = await pool.query(`delete from public.meeting_recordings where created_at < $1::timestamptz`, [
      cutoffIso,
    ])
    return res.rowCount ?? 0
  } catch (e) {
    console.error('[meeting-recordings-pg] deleteMeetingRecordingsBeforeCutoffPg', e)
    return 0
  }
}
