import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchSessionMemoryPinnedFactsJsonPg,
  updateSessionMemoryPinnedFactsPg,
} from '@/lib/db/language-coach-session-memory-pg'

type Payload = {
  sessionId?: string
  stage?: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
}

export async function POST(request: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Cơ sở dữ liệu chưa cấu hình.' }, { status: 503 })
    }
    const payload = (await request.json()) as Payload
    const sessionId = String(payload.sessionId || '').trim()
    const stageRaw = String(payload.stage || '').trim().toLowerCase()
    const stage: 'idle' | 'writing' | 'speaking' | 'listening' | 'done' =
      stageRaw === 'writing' || stageRaw === 'speaking' || stageRaw === 'listening' || stageRaw === 'done'
        ? stageRaw
        : 'idle'

    if (!sessionId) {
      return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const mem = await fetchSessionMemoryPinnedFactsJsonPg(user.id, sessionId)
    if (!mem.ok) {
      if (mem.notFound) {
        return NextResponse.json({ error: 'Không tìm thấy buổi học để cập nhật.' }, { status: 404 })
      }
      return NextResponse.json(
        { error: mem.message || 'Không tải được trạng thái buổi học.' },
        { status: 500 }
      )
    }

    const nextPinnedFactsRaw = (() => {
      try {
        const parsed = JSON.parse(String(mem.pinned_facts_json || '{}')) as Record<string, unknown>
        const root = parsed && typeof parsed === 'object' ? { ...parsed } : {}
        root.mini_stage_snapshot = {
          stage,
          updatedAt: new Date().toISOString(),
        }
        if (stage === 'done') delete root.review_drill
        return JSON.stringify(root)
      } catch {
        return JSON.stringify({
          mini_stage_snapshot: {
            stage,
            updatedAt: new Date().toISOString(),
          },
        })
      }
    })()

    const updatedAt = new Date().toISOString()
    const upd = await updateSessionMemoryPinnedFactsPg(user.id, sessionId, nextPinnedFactsRaw, updatedAt)
    if (!upd.ok) {
      return NextResponse.json({ error: upd.message || 'Không lưu được mini stage.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
