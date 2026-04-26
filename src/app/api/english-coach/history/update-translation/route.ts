import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  updateLanguageCoachMessagePartialByIdPg,
  updateLanguageCoachMessagePartialBySessionClientPg,
} from '@/lib/db/language-coach-messages-pg'

type Payload = {
  messageId: string
  sessionId?: string
  clientMessageId?: string
  translation?: string
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
  tokensJson?: string
  audioUrl?: string
  writingTaskJson?: string
  aiPayloadJson?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const payload = (await request.json()) as Payload
    const messageId = String(payload.messageId || '').trim()
    const sessionId = String(payload.sessionId || '').trim()
    const clientMessageId = String(payload.clientMessageId || '').trim()
    const translation = String(payload.translation || '').trim()
    const mainSentence = String(payload.mainSentence || '').trim().slice(0, 2000) || null
    const correctionNote = String(payload.correctionNote || '').trim().slice(0, 2000) || null
    const intentAnswer = String(payload.intentAnswer || '').trim().slice(0, 2000) || null
    const tokensJson = String(payload.tokensJson || '').trim().slice(0, 4000) || null
    const audioUrl = String(payload.audioUrl || '').trim().slice(0, 2000) || null
    const writingTaskJson = String(payload.writingTaskJson || '').trim().slice(0, 8000) || null
    const aiPayloadJson = String(payload.aiPayloadJson || '').trim().slice(0, 32000) || null

    const updates: Record<string, string | null> = {}
    if (payload.translation !== undefined) updates.translation = translation ? translation.slice(0, 4000) : null
    if (payload.mainSentence !== undefined) updates.main_sentence = mainSentence
    if (payload.correctionNote !== undefined) updates.correction_note = correctionNote
    if (payload.intentAnswer !== undefined) updates.intent_answer = intentAnswer
    if (payload.tokensJson !== undefined) updates.tokens_json = tokensJson
    if (payload.audioUrl !== undefined) updates.audio_url = audioUrl
    if (payload.writingTaskJson !== undefined) updates.writing_task_json = writingTaskJson
    if (payload.aiPayloadJson !== undefined) updates.ai_payload_json = aiPayloadJson

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Thiếu dữ liệu cập nhật.' }, { status: 400 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)

    /**
     * Race condition phổ biến: frontend retry update-translation cho message vừa kết thúc / vừa cleanup.
     * Trả 200 với `updated: false` thay vì 404 — không bẩn log, frontend đã `.catch(() => {})` ở mọi caller
     * nên không cần signal lỗi rõ ràng. Chỉ log warn nội bộ để debug khi cần.
     */
    if (isUuid) {
      const res = await updateLanguageCoachMessagePartialByIdPg(user.id, messageId, updates)
      if (res === null) {
        return NextResponse.json({ error: 'Không cập nhật được.' }, { status: 500 })
      }
      if (res.rowCount === 0) {
        console.warn(
          `[update-translation] message not found (race/cleanup) userId=${user.id} messageId=${messageId.slice(0, 8)}`
        )
        return NextResponse.json({ ok: true, updated: false, reason: 'not_found' })
      }
      return NextResponse.json({ ok: true, updated: true })
    }

    if (sessionId && clientMessageId) {
      const res = await updateLanguageCoachMessagePartialBySessionClientPg(
        user.id,
        sessionId,
        clientMessageId,
        updates
      )
      if (res === null) {
        return NextResponse.json({ error: 'Không cập nhật được.' }, { status: 500 })
      }
      if (res.rowCount === 0) {
        console.warn(
          `[update-translation] session+client not found (race/cleanup) userId=${user.id} sessionId=${sessionId.slice(0, 8)} clientMessageId=${clientMessageId.slice(0, 16)}`
        )
        return NextResponse.json({ ok: true, updated: false, reason: 'not_found' })
      }
      return NextResponse.json({ ok: true, updated: true })
    }

    return NextResponse.json({ error: 'Cần messageId (uuid) hoặc sessionId + clientMessageId.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
