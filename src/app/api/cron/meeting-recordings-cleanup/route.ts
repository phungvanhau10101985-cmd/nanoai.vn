import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteMeetingRecordingsBeforeCutoffPg,
  listMeetingRecordingStoragePathsBeforeCutoffPg,
} from '@/lib/db/meeting-recordings-pg'
import { MEETING_RECORDING_RETENTION_DAYS } from '@/lib/meeting-recording-config'
import { removeMeetingRecordingObjects } from '@/lib/storage/meeting-recordings-storage'
import { bunnyStorageConfigured } from '@/lib/storage/try-on-public-upload'

/**
 * Cron: xóa file audio trên Bunny rồi xóa dòng `meeting_recordings` quá hạn.
 * Bảo vệ: Authorization: Bearer <MEETING_RECORDINGS_CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.MEETING_RECORDINGS_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'MEETING_RECORDINGS_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL not configured.' }, { status: 500 })
  }
  if (!bunnyStorageConfigured()) {
    return NextResponse.json(
      { error: 'Bunny Storage chưa cấu hình (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).' },
      { status: 503 }
    )
  }

  try {
    const retentionMs = MEETING_RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const cutoffIso = new Date(Date.now() - retentionMs).toISOString()
    const stalePaths = await listMeetingRecordingStoragePathsBeforeCutoffPg(cutoffIso)
    if (stalePaths.length > 0) {
      await removeMeetingRecordingObjects(stalePaths)
    }

    const deleted = await deleteMeetingRecordingsBeforeCutoffPg(cutoffIso)
    return NextResponse.json({
      ok: true,
      deletedRows: deleted,
      retentionDays: MEETING_RECORDING_RETENTION_DAYS,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/meeting-recordings-cleanup]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
