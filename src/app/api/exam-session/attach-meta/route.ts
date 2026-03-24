import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Danh sách class_id đã có phiên thuộc cùng lineage với phiên nguồn (đã gắn rồi). */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const sourceSessionId = String(req.nextUrl.searchParams.get('sourceSessionId') ?? '').trim()
    if (!sourceSessionId) {
      return NextResponse.json({ error: 'Thiếu phiên nguồn.' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data: src, error: srcErr } = await admin
      .from('exam_sessions')
      .select('id, exam_lineage_root_id')
      .eq('id', sourceSessionId)
      .eq('teacher_id', user.id)
      .single()

    if (srcErr || !src) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const row = src as { id: string; exam_lineage_root_id?: string | null }
    const rootId = String(row.exam_lineage_root_id ?? row.id).trim()

    const occupied = new Set<string>()
    const pushClass = (cid: unknown) => {
      if (cid == null) return
      const s = String(cid).trim().toLowerCase()
      if (s) occupied.add(s)
    }

    /** Mọi phiên cùng lineage (gốc đã backfill + bản gắn lớp). */
    const { data: byLineage, error: linErr } = await admin
      .from('exam_sessions')
      .select('class_id')
      .eq('teacher_id', user.id)
      .eq('exam_lineage_root_id', rootId)

    if (linErr) return NextResponse.json({ error: linErr.message }, { status: 500 })
    for (const r of byLineage ?? []) pushClass((r as { class_id?: string | null }).class_id)

    /** Phiên gốc còn null exam_lineage_root_id (chưa migrate / lỗi cập nhật) — vẫn lấy class_id. */
    const { data: rootRow, error: rootErr } = await admin
      .from('exam_sessions')
      .select('class_id')
      .eq('teacher_id', user.id)
      .eq('id', rootId)
      .maybeSingle()

    if (rootErr) return NextResponse.json({ error: rootErr.message }, { status: 500 })
    if (rootRow) pushClass((rootRow as { class_id?: string | null }).class_id)

    return NextResponse.json({
      lineageRootId: rootId,
      occupiedClassIds: Array.from(occupied),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
