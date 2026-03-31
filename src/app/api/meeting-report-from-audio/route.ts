import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  MEETING_REPORT_MAX_DURATION_SECONDS,
  MEETING_REPORT_MAX_FILE_BYTES,
  capMeetingDurationByFileSize,
  computeMeetingReportCredits,
} from '@/lib/meeting-report-pricing'
import { MEETING_RECORDINGS_BUCKET } from '@/lib/meeting-recording-config'

export const maxDuration = 300
export const runtime = 'nodejs'

const REPORT_LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

type ParsedOut = { transcript: string; reportMarkdown: string }

function safeParseJson(text: string): ParsedOut | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const o = JSON.parse(cleaned) as { transcript?: unknown; reportMarkdown?: unknown }
    const transcript = String(o.transcript || '').trim()
    const reportMarkdown = String(o.reportMarkdown || '').trim()
    if (!transcript && !reportMarkdown) return null
    return { transcript, reportMarkdown }
  } catch {
    return null
  }
}

function reportLanguageName(locale: string): string {
  switch (locale) {
    case 'en':
      return 'English'
    case 'zh':
      return 'Simplified Chinese'
    case 'ja':
      return 'Japanese'
    case 'ko':
      return 'Korean'
    default:
      return 'Vietnamese'
  }
}

export async function POST(request: NextRequest) {
  let chargedAmount = 0
  let userIdForRefund: string | null = null

  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để tạo báo cáo.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const { user } = auth
    userIdForRefund = user.id

    const form = await request.formData()
    const recordingId = String(form.get('recordingId') || '').trim()
    const file = form.get('audio')

    const titleRaw = String(form.get('title') || '').trim()
    let titleForPrompt = titleRaw.slice(0, 200) || 'Cuộc họp'
    const reportLocaleRaw = String(form.get('reportLocale') || 'vi').toLowerCase()
    const reportLocale = REPORT_LOCALES.has(reportLocaleRaw) ? reportLocaleRaw : 'vi'

    let buf: Buffer
    let mimeType: string
    let billingDuration: number
    let claimedDuration: number

    if (recordingId) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      if (!url || !serviceKey) {
        return NextResponse.json({ error: 'Thiếu cấu hình máy chủ.' }, { status: 500 })
      }
      const admin = createSupabaseAdmin(url, serviceKey)
      const { data: row, error: rowErr } = await admin
        .from('meeting_recordings')
        .select('id, user_id, title, storage_path, duration_seconds, mime_type, file_size_bytes')
        .eq('id', recordingId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (rowErr || !row) {
        return NextResponse.json({ error: 'Không tìm thấy bản ghi hoặc đã hết hạn.' }, { status: 404 })
      }

      if (!titleRaw) {
        titleForPrompt = String(row.title || '').trim().slice(0, 200) || 'Cuộc họp'
      }

      const titleToStore = titleRaw || String(row.title || '')
      if (titleToStore !== row.title) {
        await admin.from('meeting_recordings').update({ title: titleToStore.slice(0, 200) }).eq('id', recordingId)
      }

      const { data: dl, error: dlErr } = await admin.storage
        .from(MEETING_RECORDINGS_BUCKET)
        .download(row.storage_path)

      if (dlErr || !dl) {
        return NextResponse.json({ error: 'Không đọc được file âm thanh trên máy chủ.' }, { status: 404 })
      }

      buf = Buffer.from(await dl.arrayBuffer())
      if (buf.length > MEETING_REPORT_MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File âm thanh quá lớn (tối đa 20MB).' }, { status: 400 })
      }

      mimeType =
        row.mime_type && String(row.mime_type).startsWith('audio/')
          ? String(row.mime_type).split(';')[0].trim()
          : 'audio/webm'
      claimedDuration = Math.floor(Number(row.duration_seconds) || 0)
      if (claimedDuration < 1 || claimedDuration > MEETING_REPORT_MAX_DURATION_SECONDS) {
        return NextResponse.json({ error: 'Thời lượng ghi âm không hợp lệ.' }, { status: 400 })
      }
      billingDuration = capMeetingDurationByFileSize(Number(row.file_size_bytes) || buf.length, claimedDuration)
      if (billingDuration < 1) {
        return NextResponse.json({ error: 'File âm thanh không khớp thời lượng.' }, { status: 400 })
      }
    } else {
      if (!(file instanceof Blob) || file.size < 16) {
        return NextResponse.json({ error: 'Thiếu file âm thanh hoặc mã bản ghi.' }, { status: 400 })
      }
      if (file.size > MEETING_REPORT_MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File âm thanh quá lớn (tối đa 20MB).' }, { status: 400 })
      }
      const durationRaw = Number(form.get('durationSeconds'))
      claimedDuration = Number.isFinite(durationRaw) ? Math.floor(durationRaw) : 0
      if (claimedDuration < 1 || claimedDuration > MEETING_REPORT_MAX_DURATION_SECONDS) {
        return NextResponse.json({ error: 'Thời lượng ghi âm không hợp lệ.' }, { status: 400 })
      }
      billingDuration = capMeetingDurationByFileSize(file.size, claimedDuration)
      if (billingDuration < 1) {
        return NextResponse.json({ error: 'File âm thanh quá nhỏ so với thời lượng khai báo.' }, { status: 400 })
      }
      buf = Buffer.from(await file.arrayBuffer())
      mimeType = file.type && file.type.startsWith('audio/') ? file.type.split(';')[0].trim() : 'audio/webm'
    }

    const title = titleForPrompt

    const cost = computeMeetingReportCredits(billingDuration)
    const deducted = await deductUserCredits(user.id, cost)
    if (!deducted.ok) {
      if (deducted.code === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json({ error: deducted.error, code: 'INSUFFICIENT_CREDITS' }, { status: 402 })
      }
      return NextResponse.json({ error: deducted.error }, { status: 500 })
    }
    chargedAmount = deducted.charged

    const audioBase64 = buf.toString('base64')

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      await refundUserCredits(user.id, chargedAmount)
      chargedAmount = 0
      return NextResponse.json({ error: 'Thiếu cấu hình AI.' }, { status: 500 })
    }

    const lang = reportLanguageName(reportLocale)
    const prompt = `You are a professional meeting assistant. Listen to the entire audio.

Meeting title (context only): "${title.replace(/"/g, '\\"')}"

Tasks:
1) Transcribe faithfully what is spoken (same language as the audio). If multiple languages, keep them as heard.
2) Write a structured meeting report in ${lang} (the report language must be ${lang}, not necessarily the audio language).

Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "transcript": "full transcript as plain text",
  "reportMarkdown": "markdown report with sections like: Summary, Key points, Decisions, Action items (owner + deadline if mentioned), Open questions"
}

Do not invent facts not supported by the audio. If something is unclear, say so briefly in the report.`

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)

    let textOut = ''
    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
      ])
      textOut = result.response.text()?.trim() || ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gemini error'
      await refundUserCredits(user.id, chargedAmount)
      chargedAmount = 0
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const parsed = safeParseJson(textOut)
    if (!parsed) {
      await refundUserCredits(user.id, chargedAmount)
      chargedAmount = 0
      return NextResponse.json({ error: 'Không đọc được kết quả từ AI.' }, { status: 502 })
    }

    return NextResponse.json({
      transcript: parsed.transcript,
      reportMarkdown: parsed.reportMarkdown,
      charged: cost,
      balance: deducted.balance,
      billedDurationSeconds: billingDuration,
      claimedDurationSeconds: claimedDuration,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    if (chargedAmount > 0 && userIdForRefund) {
      await refundUserCredits(userIdForRefund, chargedAmount)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
