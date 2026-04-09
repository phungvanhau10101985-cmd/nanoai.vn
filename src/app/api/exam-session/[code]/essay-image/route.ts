import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getUserForAction } from '@/lib/auth'
import { hasCompleteClassMemberProfileForExamPg } from '@/lib/db/classes-pg'
import {
  fetchExamAttemptOpenForDraftPg,
  fetchExamSessionActiveForStudentFlowPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { CLASS_ENROLLMENT_ERROR_VI } from '@/lib/lop/require-class-enrollment'
import { isServerDeadlinePassed } from '@/lib/exam-session/finalize-overdue-exam-attempt'
import { EXAM_ESSAY_IMAGES_BUCKET } from '@/lib/exam-essay-config'
import { uploadExamEssayImagePublic } from '@/lib/storage/exam-essay-public-upload'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Bunny upload — tham số đầu legacy (không dùng). */
const LEGACY_DB_UNUSED = null

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await getUserForAction('Vui lòng đăng nhập.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const user = auth.user

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

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const sessionRow = await fetchExamSessionActiveForStudentFlowPg(code.toUpperCase())
    if (sessionRow === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài thi.' }, { status: 500 })
    }
    if (sessionRow === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(sessionRow.id) || layout.userId !== user.id) {
      return NextResponse.json(
        { error: 'Phiên làm bài không hợp lệ. Vui lòng tải lại trang.' },
        { status: 400 }
      )
    }

    const attemptState = await fetchExamAttemptOpenForDraftPg(sessionRow.id, user.id)
    if (attemptState === null) {
      return NextResponse.json({ error: 'Lỗi đọc phiên làm bài.' }, { status: 500 })
    }
    if (attemptState === 'submitted') {
      return NextResponse.json({ error: 'Bạn đã nộp bài, không thể tải thêm ảnh.' }, { status: 409 })
    }

    const durationMin = sessionRow.duration_minutes
    if (attemptState !== 'missing') {
      const attemptRow = attemptState
      if (
        isServerDeadlinePassed(
          attemptRow.deadline_at,
          attemptRow.started_at,
          durationMin,
          Date.now()
        )
      ) {
        return NextResponse.json(
          { error: 'Đã hết thời gian làm bài. Vui lòng tải lại trang.' },
          { status: 400 }
        )
      }
    }

    if (sessionRow.class_id) {
      const ok = await hasCompleteClassMemberProfileForExamPg(String(sessionRow.class_id), user.id)
      if (ok === null) {
        return NextResponse.json({ error: 'Lỗi kiểm tra tham gia lớp.' }, { status: 500 })
      }
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const objectPath = `${sessionRow.id}/${user.id}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())

    try {
      const { publicUrl } = await uploadExamEssayImagePublic(LEGACY_DB_UNUSED, objectPath, buf, {
        contentType: mime,
        upsert: false,
      })
      return NextResponse.json({ url: publicUrl })
    } catch (upErr: unknown) {
      const msg = upErr instanceof Error ? upErr.message : String(upErr)
      console.error('[exam-essay-image]', msg)
      const likelyConfig = /Thiếu Bunny Storage|Bunny exam-essay upload failed/i.test(msg)
      return NextResponse.json(
        {
          error: likelyConfig
            ? `Cấu hình Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL). Ảnh bài thi lưu trong zone với prefix "${EXAM_ESSAY_IMAGES_BUCKET}/".`
            : 'Tải ảnh lên thất bại.',
        },
        { status: 500 }
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
