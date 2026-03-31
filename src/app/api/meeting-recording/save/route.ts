import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import {
  MEETING_REPORT_MAX_DURATION_SECONDS,
  MEETING_REPORT_MAX_FILE_BYTES,
} from '@/lib/meeting-report-pricing'
import { MEETING_RECORDINGS_BUCKET } from '@/lib/meeting-recording-config'

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
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu bản ghi.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const { user } = auth

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Thiếu cấu hình máy chủ.' }, { status: 500 })
    }
    const admin = createSupabaseAdmin(url, serviceKey)

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
    const { error: upErr } = await admin.storage
      .from(MEETING_RECORDINGS_BUCKET)
      .upload(storagePath, buf, { contentType: mimeType, upsert: false })

    if (upErr) {
      console.error('[meeting-recording/save] upload', upErr.message)
      return NextResponse.json({ error: 'Không upload được bản ghi.' }, { status: 500 })
    }

    const { error: insErr } = await admin.from('meeting_recordings').insert({
      id,
      user_id: user.id,
      title,
      storage_path: storagePath,
      duration_seconds: durationSeconds,
      mime_type: mimeType,
      file_size_bytes: buf.length,
    })

    if (insErr) {
      console.error('[meeting-recording/save] insert', insErr.message)
      await admin.storage.from(MEETING_RECORDINGS_BUCKET).remove([storagePath])
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
