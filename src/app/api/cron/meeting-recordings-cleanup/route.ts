import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MEETING_RECORDING_RETENTION_DAYS } from '@/lib/meeting-recording-config'

/**
 * Cron: xóa bản ghi cuộc họp (DB + storage) quá hạn.
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase service env.' }, { status: 500 })
  }

  const admin = createClient(url, key)
  try {
    const { data, error } = await admin.rpc('cleanup_meeting_recordings_older_than', {
      p_days: MEETING_RECORDING_RETENTION_DAYS,
    })
    if (error) {
      console.error('[cron/meeting-recordings-cleanup]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const deleted = (() => {
      if (typeof data === 'bigint') return Number(data)
      if (typeof data === 'number' && Number.isFinite(data)) return data
      if (typeof data === 'string') {
        const n = Number(data)
        return Number.isFinite(n) ? n : 0
      }
      return 0
    })()
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
