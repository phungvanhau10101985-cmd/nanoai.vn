import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { insertMeetingRecordingPg } from '@/lib/db/meeting-recordings-pg'
import {
  MEETING_REPORT_MAX_DURATION_SECONDS,
  MEETING_REPORT_MAX_FILE_BYTES,
} from '@/lib/meeting-report-pricing'
import {
  removeMeetingRecordingObjects,
  uploadMeetingRecordingObject,
} from '@/lib/storage/meeting-recordings-storage'
import { bunnyStorageConfigured } from '@/lib/storage/try-on-public-upload'

export const maxDuration = 120
export const runtime = 'nodejs'

function extFromMime(m: string): string {
  const base = m.split(';')[0].trim().toLowerCase()
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'm4a'
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/wav') return 'wav'
  if (base === 'audio/mpeg') return 'mp3'
  return 'webm'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const { user } = auth

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }, { status: 500 })
    }
    if (!bunnyStorageConfigured()) {
      return NextResponse.json({ error: 'Thiếu cấu hình Bunny Storage cho bản ghi âm.' }, { status: 500 })
    }

    const form = await request.formData()
    const file = form.get('audio')
    if (!(file instanceof Blob) || file.size < 32) {
      return NextResponse.json({ error: 'Thiếu file âm thanh.' }, { status: 400 })
    }
    if (file.size > MEETING_REPORT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File âm thanh quá lớn (tối đa 20MB).' }, { status: 400 })
    }

    const durationRaw = Number(form.get('durationSeconds'))
    const durationSeconds = Number.isFinite(durationRaw) ? Math.floor(durationRaw) : 0
    if (durationSeconds < 1 || durationSeconds > MEETING_REPORT_MAX_DURATION_SECONDS) {
      return NextResponse.json({ error: 'Thời lượng không hợp lệ.' }, { status: 400 })
    }

    const title = String(form.get('title') || '').trim().slice(0, 200)
    const mimeRaw = String(form.get('mimeType') || file.type || 'audio/webm').trim()
    const mimeType = mimeRaw.startsWith('audio/') ? mimeRaw.split(';')[0].trim() : 'audio/webm'
    const ext = extFromMime(mimeType)
    const id = randomUUID()
    const storagePath = `${user.id}/${id}.${ext}`

    const buf = Buffer.from(await file.arrayBuffer())
    try {
      await uploadMeetingRecordingObject(storagePath, buf, mimeType)
    } catch (upErr) {
      const msg = upErr instanceof Error ? upErr.message : 'upload failed'
      console.error('[meeting-recording/save] upload', msg)
      return NextResponse.json({ error: 'Không upload được bản ghi.' }, { status: 500 })
    }

    const ok = await insertMeetingRecordingPg({
      id,
      userId: user.id,
      title,
      storagePath,
      durationSeconds,
      mimeType,
      fileSizeBytes: buf.length,
    })

    if (!ok) {
      console.error('[meeting-recording/save] insert failed')
      await removeMeetingRecordingObjects([storagePath])
      return NextResponse.json({ error: 'Không lưu được metadata bản ghi.' }, { status: 500 })
    }

    return NextResponse.json({
      id,
      title,
      durationSeconds,
      fileSizeBytes: buf.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
