import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { insertPartnerProductAdminAnswerFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/**
 * M1.3 — trả lời của merchant (admin), không giới hạn slot, không cần điều kiện mua hàng.
 * Tên hiển thị mặc định = tên shop nếu không nhập tên riêng.
 */
export async function POST(
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

  const body = (await req.json().catch(() => ({}))) as { content?: string; responderName?: string }
  const content = String(body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  let responderName = String(body.responderName ?? '').trim()
  if (!responderName) {
    const partners = await fetchMessagingPartnersByIdsFromPg([pid])
    responderName = partners?.[0]?.display_name?.trim() || 'Shop'
  }

  const row = await insertPartnerProductAdminAnswerFromPg({
    partnerId: pid,
    questionId,
    responderName,
    content,
  })
  if (!row) return NextResponse.json({ error: 'Could not submit answer' }, { status: 500 })
  return NextResponse.json({ success: true, answer: row })
}
