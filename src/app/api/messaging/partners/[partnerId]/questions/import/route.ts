import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { insertImportedPartnerProductQuestionsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { parseQuestionImportWorkbook } from '@/lib/partner-website/reviews/partner-reviews-qa-excel'

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    return NextResponse.json({ error: 'xlsx_only' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const drafts = parseQuestionImportWorkbook(buffer)
  if (drafts.length === 0) {
    return NextResponse.json({ error: 'empty_file', created: 0 }, { status: 400 })
  }
  const created = await insertImportedPartnerProductQuestionsFromPg(pid, drafts)
  return NextResponse.json({ ok: true, created })
}
