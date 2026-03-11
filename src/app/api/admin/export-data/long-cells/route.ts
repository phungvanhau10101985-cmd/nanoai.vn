import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const EXCEL_MAX_CELL = 32767

async function requireAdmin() {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error, status: 401 }
  const { user } = authResult
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: 'Chỉ quản trị viên mới được kiểm tra.', status: 403 }
  }
  return { user }
}

/** GET: Tìm các ô có dữ liệu > 32767 ký tự (giới hạn Excel) */
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const results: Array<{ table: string; id: string; column: string; length: number; preview: string }> = []

  // worksheet_official_questions - phân trang để lấy hết
  const PAGE_SIZE = 1000
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data: questions } = await admin
      .from('worksheet_official_questions')
      .select('id, question_text, explanation, options')
      .range(offset, offset + PAGE_SIZE - 1)
    if (!questions?.length) break
    for (const row of questions) {
      const q = row.question_text ?? ''
      if (q.length > EXCEL_MAX_CELL) {
        results.push({
          table: 'worksheet_official_questions',
          id: row.id,
          column: 'question_text',
          length: q.length,
          preview: q.slice(0, 100) + '...',
        })
      }
      const exp = (row.explanation ?? '') as string
      if (exp.length > EXCEL_MAX_CELL) {
        results.push({
          table: 'worksheet_official_questions',
          id: row.id,
          column: 'explanation',
          length: exp.length,
          preview: exp.slice(0, 100) + '...',
        })
      }
      const opts = row.options as string[] | null
      if (Array.isArray(opts)) {
        const flattened = opts.map((s, i) => `${String.fromCharCode(65 + i)}. ${s}`).join(' | ')
        if (flattened.length > EXCEL_MAX_CELL) {
          results.push({
            table: 'worksheet_official_questions',
            id: row.id,
            column: 'options',
            length: flattened.length,
            preview: flattened.slice(0, 100) + '...',
          })
        }
      }
    }
    hasMore = questions.length === PAGE_SIZE
    offset += PAGE_SIZE
  }

  results.sort((a, b) => b.length - a.length)

  return NextResponse.json({
    maxCellChars: EXCEL_MAX_CELL,
    violations: results,
    summary: results.length
      ? `${results.length} ô vượt giới hạn (${EXCEL_MAX_CELL} ký tự)`
      : 'Không có ô nào vượt giới hạn.',
  })
}
