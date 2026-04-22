import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchMeetingRecordingForUserPg, updateMeetingRecordingTitlePg } from '@/lib/db/meeting-recordings-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  MEETING_REPORT_CHUNKED_PIPELINE_THRESHOLD_SECONDS,
  MEETING_REPORT_MAX_DURATION_SECONDS,
  MEETING_REPORT_MAX_FILE_BYTES,
  capMeetingDurationByFileSize,
  computeMeetingReportCredits,
} from '@/lib/meeting-report-pricing'
import { downloadMeetingRecordingBuffer } from '@/lib/storage/meeting-recordings-storage'

export const maxDuration = 300
export const runtime = 'nodejs'

const TRANSCRIBE_CONCURRENT_CHUNKS = 2

const REPORT_LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

type LoadedSegment = {
  id: string
  buf: Buffer
  mimeType: string
  claimedDuration: number
  billingSlice: number
}

type ParsedOut = { transcript: string; reportMarkdown: string; reportBriefMarkdown: string }

function safeParseReportMarkdownJson(text: string): { reportMarkdown: string; reportBriefMarkdown: string } | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const o = JSON.parse(cleaned) as {
      reportMarkdown?: unknown
      reportBriefMarkdown?: unknown
    }
    const reportMarkdown = String(o.reportMarkdown || '').trim()
    const reportBriefMarkdown = String(o.reportBriefMarkdown || '').trim()
    if (!reportMarkdown) return null
    return { reportMarkdown, reportBriefMarkdown }
  } catch {
    return null
  }
}

function safeParseJson(text: string): ParsedOut | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const o = JSON.parse(cleaned) as {
      transcript?: unknown
      reportMarkdown?: unknown
      reportBriefMarkdown?: unknown
    }
    const transcript = String(o.transcript || '').trim()
    const reportMarkdown = String(o.reportMarkdown || '').trim()
    const reportBriefMarkdown = String(o.reportBriefMarkdown || '').trim()
    if (!transcript && !reportMarkdown) return null
    return { transcript, reportMarkdown, reportBriefMarkdown }
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

function parseRecordingIds(form: FormData): string[] {
  const raw = form.get('recordingIds')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean)
      }
    } catch {
      // ignore
    }
  }
  const single = String(form.get('recordingId') || '').trim()
  return single ? [single] : []
}

export async function POST(request: NextRequest) {
  let chargedAmount = 0
  let userIdForRefund: string | null = null

  try {
    const auth = await getUserForCreditAction()
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const { user } = auth
    userIdForRefund = user.id

    const form = await request.formData()
    const ids = parseRecordingIds(form)
    const file = form.get('audio')

    const titleRaw = String(form.get('title') || '').trim()
    let titleForPrompt = titleRaw.slice(0, 200) || 'Cuộc họp'
    const reportLocaleRaw = String(form.get('reportLocale') || 'vi').toLowerCase()
    const reportLocale = REPORT_LOCALES.has(reportLocaleRaw) ? reportLocaleRaw : 'vi'

    let segments: LoadedSegment[] = []
    let billingDuration = 0
    let claimedDuration = 0

    if (ids.length > 0) {
      if (!isPgConfigured()) {
        return NextResponse.json({ error: 'Thiếu cấu hình cơ sở dữ liệu (DATABASE_URL).' }, { status: 500 })
      }

      for (const recordingId of ids) {
        const row = await fetchMeetingRecordingForUserPg(recordingId, user.id)

        if (!row) {
          return NextResponse.json({ error: 'Không tìm thấy bản ghi hoặc đã hết hạn.' }, { status: 404 })
        }

        if (!titleForPrompt || titleForPrompt === 'Cuộc họp') {
          titleForPrompt = String(row.title || '').trim().slice(0, 200) || 'Cuộc họp'
        }

        const titleToStore = titleRaw || String(row.title || '')
        if (titleToStore !== row.title) {
          await updateMeetingRecordingTitlePg(recordingId, user.id, titleToStore.slice(0, 200))
        }

        let buf: Buffer
        try {
          buf = await downloadMeetingRecordingBuffer(row.storage_path)
        } catch {
          return NextResponse.json({ error: 'Không đọc được file âm thanh trên máy chủ.' }, { status: 404 })
        }
        if (buf.length > MEETING_REPORT_MAX_FILE_BYTES) {
          return NextResponse.json({ error: 'Một đoạn âm thanh quá lớn (tối đa 20MB).' }, { status: 400 })
        }

        const mimeType =
          row.mime_type && String(row.mime_type).startsWith('audio/')
            ? String(row.mime_type).split(';')[0].trim()
            : 'audio/webm'
        const claimed = Math.floor(Number(row.duration_seconds) || 0)
        if (claimed < 1 || claimed > MEETING_REPORT_MAX_DURATION_SECONDS) {
          return NextResponse.json({ error: 'Thời lượng ghi âm không hợp lệ.' }, { status: 400 })
        }
        const slice = capMeetingDurationByFileSize(Number(row.file_size_bytes) || buf.length, claimed)
        if (slice < 1) {
          return NextResponse.json({ error: 'File âm thanh không khớp thời lượng.' }, { status: 400 })
        }

        segments.push({
          id: recordingId,
          buf,
          mimeType,
          claimedDuration: claimed,
          billingSlice: slice,
        })
      }

      claimedDuration = segments.reduce((s, x) => s + x.claimedDuration, 0)
      billingDuration = segments.reduce((s, x) => s + x.billingSlice, 0)
      claimedDuration = Math.min(claimedDuration, MEETING_REPORT_MAX_DURATION_SECONDS)
      billingDuration = Math.min(billingDuration, MEETING_REPORT_MAX_DURATION_SECONDS)
    } else {
      if (!(file instanceof Blob) || file.size < 16) {
        return NextResponse.json({ error: 'Thiếu file âm thanh hoặc mã bản ghi.' }, { status: 400 })
      }
      if (file.size > MEETING_REPORT_MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File âm thanh quá lớn (tối đa 20MB).' }, { status: 400 })
      }
      const durationRaw = Number(form.get('durationSeconds'))
      const claimed = Number.isFinite(durationRaw) ? Math.floor(durationRaw) : 0
      if (claimed < 1 || claimed > MEETING_REPORT_MAX_DURATION_SECONDS) {
        return NextResponse.json({ error: 'Thời lượng ghi âm không hợp lệ.' }, { status: 400 })
      }
      const slice = capMeetingDurationByFileSize(file.size, claimed)
      if (slice < 1) {
        return NextResponse.json({ error: 'File âm thanh quá nhỏ so với thời lượng khai báo.' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const mimeType =
        file.type && file.type.startsWith('audio/') ? file.type.split(';')[0].trim() : 'audio/webm'
      segments = [
        {
          id: '',
          buf,
          mimeType,
          claimedDuration: claimed,
          billingSlice: slice,
        },
      ]
      claimedDuration = claimed
      billingDuration = slice
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

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      await refundUserCredits(user.id, chargedAmount)
      chargedAmount = 0
      return NextResponse.json({ error: 'Thiếu cấu hình AI.' }, { status: 500 })
    }

    const lang = reportLanguageName(reportLocale)
    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)

    const chunkBuffers = segments.map((s) => s.buf)
    const mimeTypes = segments.map((s) => s.mimeType)
    const useStagedPipeline =
      chunkBuffers.length > 1 || billingDuration > MEETING_REPORT_CHUNKED_PIPELINE_THRESHOLD_SECONDS

    let transcript = ''
    let reportMarkdown = ''
    let reportBriefMarkdown = ''

    if (useStagedPipeline) {
      const transcribeOne = async (chunkBuf: Buffer, mime: string, index: number): Promise<string> => {
        const chunkPrompt = `Transcribe every spoken word in this audio. Output plain text only — no JSON, no markdown code fences, no labels, no commentary. Keep the same language(s) as the audio. This is audio segment ${index + 1} of ${chunkBuffers.length}.`
        const result = await model.generateContent([
          chunkPrompt,
          {
            inlineData: {
              mimeType: mime,
              data: chunkBuf.toString('base64'),
            },
          },
        ])
        void trackFromUsageMetadata(
          result.response.usageMetadata,
          GEMINI_25_FLASH_NO_THINKING.model,
          'meeting-report-audio-transcribe-chunk',
          user.id,
          null
        )
        return (result.response.text() || '').trim()
      }

      const segmentTexts: string[] = []
      for (let b = 0; b < chunkBuffers.length; b += TRANSCRIBE_CONCURRENT_CHUNKS) {
        const slice = chunkBuffers.slice(b, b + TRANSCRIBE_CONCURRENT_CHUNKS)
        try {
          const batch = await Promise.all(
            slice.map((chunkBuf, j) => transcribeOne(chunkBuf, mimeTypes[b + j] ?? mimeTypes[0], b + j))
          )
          segmentTexts.push(...batch)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Gemini error'
          await refundUserCredits(user.id, chargedAmount)
          chargedAmount = 0
          return NextResponse.json({ error: msg }, { status: 502 })
        }
      }

      transcript = segmentTexts.filter(Boolean).join('\n\n').trim()
      if (!transcript) {
        await refundUserCredits(user.id, chargedAmount)
        chargedAmount = 0
        return NextResponse.json({ error: 'Phiên âm trống sau khi xử lý từng đoạn.' }, { status: 502 })
      }

      const MAX_TX = 900_000
      const transcriptForPrompt =
        transcript.length > MAX_TX
          ? `${transcript.slice(0, MAX_TX)}\n\n[…transcript truncated for length…]`
          : transcript

      const finalPrompt = `You are a professional meeting assistant.

Meeting title (context only): "${title.replace(/"/g, '\\"')}"

Full meeting transcript (from audio, chronological order). This is the only source of facts:
"""
${transcriptForPrompt}
"""

Tasks:
1) Write a structured meeting report in ${lang} (the report language must be ${lang}). Use markdown with sections such as: Summary, Key points, Decisions, Action items (owner + deadline if mentioned), Open questions.
2) Write a separate SHORT brief in field reportBriefMarkdown: only the essentials — at most 5-8 short bullet lines (markdown bullets OK), or under ~500 characters total. No long paragraphs.

Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "reportMarkdown": "full markdown report as in task 1",
  "reportBriefMarkdown": "very short markdown: main takeaways only"
}

Do not invent facts not supported by the transcript. If something is unclear, say so briefly.`

      let textOut = ''
      try {
        const result = await model.generateContent(finalPrompt)
        void trackFromUsageMetadata(
          result.response.usageMetadata,
          GEMINI_25_FLASH_NO_THINKING.model,
          'meeting-report-audio-from-transcript',
          user.id,
          null
        )
        textOut = result.response.text()?.trim() || ''
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Gemini error'
        await refundUserCredits(user.id, chargedAmount)
        chargedAmount = 0
        return NextResponse.json({ error: msg }, { status: 502 })
      }

      const parsedReport = safeParseReportMarkdownJson(textOut)
      if (!parsedReport) {
        await refundUserCredits(user.id, chargedAmount)
        chargedAmount = 0
        return NextResponse.json({ error: 'Không đọc được kết quả từ AI.' }, { status: 502 })
      }
      reportMarkdown = parsedReport.reportMarkdown
      reportBriefMarkdown = parsedReport.reportBriefMarkdown
    } else {
      const buf = chunkBuffers[0]
      const mimeType = mimeTypes[0]
      const audioBase64 = buf.toString('base64')
      const prompt = `You are a professional meeting assistant. Listen to the entire audio.

Meeting title (context only): "${title.replace(/"/g, '\\"')}"

Tasks:
1) Transcribe faithfully what is spoken (same language as the audio). If multiple languages, keep them as heard.
2) Write a structured meeting report in ${lang} (the report language must be ${lang}, not necessarily the audio language). Use markdown with sections such as: Summary, Key points, Decisions, Action items (owner + deadline if mentioned), Open questions.
3) Write a separate SHORT brief in ${lang} in field reportBriefMarkdown: only the essentials for someone who only has 30 seconds to read — at most 5-8 short bullet lines (markdown bullets OK), or under ~500 characters total. No long paragraphs. Same facts as the audio; do not copy the full long report verbatim.

Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "transcript": "full transcript as plain text",
  "reportMarkdown": "full markdown report as in task 2",
  "reportBriefMarkdown": "very short markdown: main takeaways only"
}

Do not invent facts not supported by the audio. If something is unclear, say so briefly in the reports.`

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
        void trackFromUsageMetadata(
          result.response.usageMetadata,
          GEMINI_25_FLASH_NO_THINKING.model,
          'meeting-report-audio-unified',
          user.id,
          null
        )
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
      transcript = parsed.transcript
      reportMarkdown = parsed.reportMarkdown
      reportBriefMarkdown = parsed.reportBriefMarkdown
    }

    return NextResponse.json({
      transcript,
      reportMarkdown,
      reportBriefMarkdown,
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
