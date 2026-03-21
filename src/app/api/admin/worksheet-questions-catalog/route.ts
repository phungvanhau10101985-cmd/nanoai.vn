import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

function getAdminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

async function requireAdmin() {
  const supabase = createServerClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 }) }
  }
  return { user: auth.user }
}

function previewFromRow(type: string, content_json: unknown): string {
  if (type === 'quiz') {
    const c = content_json as { question?: string }
    return String(c?.question ?? '').replace(/\s+/g, ' ').trim().slice(0, 220)
  }
  const c = content_json as { problem?: string }
  return String(c?.problem ?? '').replace(/\s+/g, ' ').trim().slice(0, 220)
}

/** Danh sách câu trắc nghiệm / tự luận (admin) — chọn để tạo phiếu mở slide chữa bài. */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error

    const admin = getAdminServiceClient()
    if (!admin) {
      return NextResponse.json({ error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }

    const { searchParams } = req.nextUrl
    const type = (searchParams.get('type') ?? 'all').trim()
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
    const end = offset + limit - 1

    let q = admin
      .from('worksheet_questions')
      .select('id, type, topic, subject_id, grade_level_id, source, created_at, content_json')
      .order('created_at', { ascending: false })
      .range(offset, end)

    if (type === 'quiz' || type === 'essay') {
      q = q.eq('type', type)
    } else {
      q = q.in('type', ['quiz', 'essay'])
    }

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const items = (data ?? []).map((row) => ({
      id: row.id as string,
      type: row.type as string,
      topic: (row.topic as string | null) ?? '',
      subject_id: (row.subject_id as string) ?? '',
      grade_level_id: (row.grade_level_id as string) ?? '',
      source: (row.source as string | null) ?? '',
      created_at: row.created_at as string,
      preview: previewFromRow(String(row.type), row.content_json),
    }))

    return NextResponse.json({ items, limit, offset })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
