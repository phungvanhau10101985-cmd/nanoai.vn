import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchWorksheetQuestionsAdminCatalogPageFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'

async function requireAdmin() {
  const auth = await getUserForAction()
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const role = await getProfileRoleWithFallback(auth.user.id)
  if (role !== 'admin') {
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

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const { searchParams } = req.nextUrl
    const type = (searchParams.get('type') ?? 'all').trim()
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)

    const typeFilter = type === 'quiz' || type === 'essay' ? type : 'all'
    const fromPg = await fetchWorksheetQuestionsAdminCatalogPageFromPg(typeFilter, limit, offset)
    if (fromPg === null) {
      return NextResponse.json({ error: 'Không đọc được danh mục câu.' }, { status: 500 })
    }

    const items = fromPg.map((row) => ({
      id: row.id,
      type: row.type,
      topic: row.topic ?? '',
      subject_id: row.subject_id ?? '',
      grade_level_id: row.grade_level_id ?? '',
      source: row.source ?? '',
      created_at: row.created_at,
      preview: previewFromRow(String(row.type), row.content_json),
    }))
    return NextResponse.json({ items, limit, offset })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
