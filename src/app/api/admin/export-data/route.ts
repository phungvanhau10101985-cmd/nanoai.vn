import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

/** Danh sách bảng public (theo migrations) */
export const PUBLIC_TABLES = [
  'profiles',
  'credits',
  'transactions',
  'try_on_history',
  'api_usage_log',
  'translate_jobs',
  'house_build_projects',
  'music_generations',
  'worksheet_curricula',
  'worksheet_worksheets',
  'worksheet_slides',
  'worksheet_slides_original',
  'worksheet_slide_edit_history',
  'worksheet_official_questions',
  'worksheet_textbook_lessons',
  'exam_sessions',
  'exam_questions',
  'exam_attempts',
  'slide_quiz_sessions',
  'slide_quiz_responses',
  'slide_edit_proposals',
  'slide_edit_votes',
  'user_customized_slides',
  'user_customized_slides_history',
  'quiz_question_reports',
  'user_opened_curricula',
  'user_hidden_curricula',
  'notifications',
  'language_coach_learning_goals',
  'language_coach_progress_daily',
  'language_coach_review_queue',
  'language_coach_credit_events',
  'language_coach_ended_sessions',
  'language_coach_hidden_sessions',
  'language_coach_completed_lessons',
  'language_coach_messages',
  'language_coach_session_memories',
  'language_coach_tokenizations',
  'language_coach_turn_diagnostics',
  'language_coach_assessments',
  'language_coach_daily_words',
  'language_coach_custom_topics',
  'language_coach_topic_curricula',
  'language_coach_preset_turns',
  'language_coach_meaning_fix_failed',
  'language_coach_phrase_cache',
  'language_coach_vocab_cache',
  'language_coach_tts_cache',
  'language_coach_transliteration_cache',
  'language_coach_dialogue_replay_cache',
  'language_coach_opening_translation_cache',
  'language_coach_cache_daily_stats',
  'language_coach_live_lessons',
  'language_coach_live_lesson_turns',
  'language_coach_live_lesson_purchases',
  'language_coach_live_lesson_starts',
] as const

async function requireAdmin() {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error, status: 401 }
  const { user } = authResult
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: 'Chỉ quản trị viên mới được xuất dữ liệu.', status: 403 }
  }
  return { user }
}

/** GET: Danh sách bảng có thể xuất */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ tables: [...PUBLIC_TABLES] })
}

/** POST: Xuất dữ liệu theo bảng đã chọn, định dạng JSON hoặc Excel */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const body = await req.json().catch(() => ({}))
    const tables = Array.isArray(body.tables) ? (body.tables as string[]).filter((t) => PUBLIC_TABLES.includes(t as (typeof PUBLIC_TABLES)[number])) : []
    const format = String(body.format || 'json').toLowerCase() === 'xlsx' ? 'xlsx' : 'json'

    if (tables.length === 0) {
      return NextResponse.json({ error: 'Chọn ít nhất một bảng để xuất.' }, { status: 400 })
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const tablesData: Record<string, unknown[]> = {}
    for (const table of tables) {
      const { data, error } = await admin.from(table).select('*')
      if (error) {
        tablesData[table] = [{ _error: error.message }]
      } else {
        tablesData[table] = data ?? []
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10)

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()
      for (const [tableName, rows] of Object.entries(tablesData)) {
        const sheetName = tableName.slice(0, 31) // Excel sheet name max 31 chars
        const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[])
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="db-export-${dateStr}.xlsx"`,
        },
      })
    }

    const payload = { exported_at: new Date().toISOString(), tables: tablesData }
    return NextResponse.json(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="db-export-${dateStr}.json"`,
      },
    })
  } catch (e) {
    console.error('[export-data]', e)
    return NextResponse.json({ error: 'Lỗi xuất dữ liệu.' }, { status: 500 })
  }
}
