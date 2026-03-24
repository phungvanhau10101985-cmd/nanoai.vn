import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { CLASS_ENROLLMENT_ERROR_VI, hasCompleteClassEnrollment } from '@/lib/lop/require-class-enrollment'
import { randomBytes } from 'crypto'
import { EXAM_ESSAY_IMAGES_BUCKET } from '@/lib/exam-essay-config'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const serverSupabase = createServerClient()
    const { data: authData } = await serverSupabase.auth.getUser()
    const user = authData.user
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
    }

    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400 })
    }

    const form = await req.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Thiếu dữ liệu tải lên.' }, { status: 400 })
    }
    const layoutToken = String(form.get('layoutToken') ?? '').trim()
    const file = form.get('file')
    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ error: 'Chưa chọn ảnh.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ảnh tối đa 5MB.' }, { status: 400 })
    }
    const mime = (file.type || 'application/octet-stream').toLowerCase()
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: 'Chỉ nhận JPEG, PNG hoặc WebP.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, class_id, school_id')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(session.id) || layout.userId !== user.id) {
      return NextResponse.json(
        { error: 'Phiên làm bài không hợp lệ. Vui lòng tải lại trang.' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .limit(1)
    if (existing?.length) {
      return NextResponse.json({ error: 'Bạn đã nộp bài, không thể tải thêm ảnh.' }, { status: 409 })
    }

    if (session.class_id) {
      const ok = await hasCompleteClassEnrollment(supabase, String(session.class_id), user.id)
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const objectPath = `${session.id}/${user.id}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabase.storage
      .from(EXAM_ESSAY_IMAGES_BUCKET)
      .upload(objectPath, buf, { contentType: mime, upsert: false })

    if (upErr) {
      console.error('[exam-essay-image]', upErr.message)
      const msg = String(upErr.message ?? '')
      const bucketMissing = /bucket not found/i.test(msg)
      return NextResponse.json(
        {
          error: bucketMissing
            ? `Storage bucket "${EXAM_ESSAY_IMAGES_BUCKET}" chưa có trên Supabase. Vào Dashboard → Storage tạo bucket public cùng tên hoặc chạy migration 20260327100000_exam_essay_submission_storage.sql.`
            : 'Tải ảnh lên thất bại.',
        },
        { status: 500 }
      )
    }

    const { data: pub } = supabase.storage.from(EXAM_ESSAY_IMAGES_BUCKET).getPublicUrl(objectPath)
    return NextResponse.json({ url: pub.publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
