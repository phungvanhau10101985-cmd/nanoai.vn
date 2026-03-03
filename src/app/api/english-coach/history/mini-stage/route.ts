import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Payload = {
  sessionId?: string
  stage?: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
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

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu tiến độ.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { data: memory, error: memoryError } = await adminSupabase
      .from('language_coach_session_memories')
      .select('pinned_facts_json')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .limit(1)
      .maybeSingle()

    if (memoryError) {
      return NextResponse.json({ error: memoryError.message || 'Không tải được trạng thái buổi học.' }, { status: 500 })
    }
    if (!memory) {
      return NextResponse.json({ error: 'Không tìm thấy buổi học để cập nhật.' }, { status: 404 })
    }

    const nextPinnedFactsRaw = (() => {
      try {
        const parsed = JSON.parse(String(memory.pinned_facts_json || '{}')) as Record<string, unknown>
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

    const { error: updateError } = await adminSupabase
      .from('language_coach_session_memories')
      .update({
        pinned_facts_json: nextPinnedFactsRaw,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('session_id', sessionId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message || 'Không lưu được mini stage.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
