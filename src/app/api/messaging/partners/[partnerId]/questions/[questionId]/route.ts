import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  deletePartnerProductQuestionFromPg,
  updatePartnerProductQuestionFromPg,
  upsertPartnerQuestionReplySlotsFromPg,
} from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** M1.3 — inline auto-save câu hỏi (is_active/content) + xoá từng dòng (không có xoá hàng loạt). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; questionId: string }> }
) {
  const { partnerId, questionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    isActive?: boolean
    content?: string
    askerName?: string
    usefulCount?: number
    importGroup?: number
    replyAdminName?: string
    replyAdminContent?: string
    replyUserOneName?: string
    replyUserOneContent?: string
    replyUserTwoName?: string
    replyUserTwoContent?: string
  }
  const questionPatch = {
    isActive: body.isActive,
    content: body.content,
    askerName: body.askerName,
    usefulCount: body.usefulCount,
    importGroup: body.importGroup,
  }
  const hasQuestionPatch = Object.values(questionPatch).some((v) => v !== undefined)
  const hasSlotPatch =
    body.replyAdminName !== undefined ||
    body.replyAdminContent !== undefined ||
    body.replyUserOneName !== undefined ||
    body.replyUserOneContent !== undefined ||
    body.replyUserTwoName !== undefined ||
    body.replyUserTwoContent !== undefined

  if (!hasQuestionPatch && !hasSlotPatch) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const row = hasQuestionPatch
    ? await updatePartnerProductQuestionFromPg(pid, questionId, questionPatch)
    : null
  if (hasQuestionPatch && !row) return NextResponse.json({ error: 'Could not update question' }, { status: 500 })

  let answers = undefined
  if (hasSlotPatch) {
    answers = await upsertPartnerQuestionReplySlotsFromPg(pid, questionId, {
      admin:
        body.replyAdminName !== undefined || body.replyAdminContent !== undefined
          ? { name: body.replyAdminName, content: body.replyAdminContent }
          : undefined,
      userOne:
        body.replyUserOneName !== undefined || body.replyUserOneContent !== undefined
          ? { name: body.replyUserOneName, content: body.replyUserOneContent }
          : undefined,
      userTwo:
        body.replyUserTwoName !== undefined || body.replyUserTwoContent !== undefined
          ? { name: body.replyUserTwoName, content: body.replyUserTwoContent }
          : undefined,
    })
    if (!answers) return NextResponse.json({ error: 'Could not update replies' }, { status: 500 })
  }

  return NextResponse.json({ success: true, question: row, answers })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; questionId: string }> }
) {
  const { partnerId, questionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ok = await deletePartnerProductQuestionFromPg(pid, questionId)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
