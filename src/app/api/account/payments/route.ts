import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { insertPendingPayment, listPaymentsForUser } from '@/lib/db/payments-repo'

export const dynamic = 'force-dynamic'

/** GET: lịch sử / danh sách payments của user đăng nhập. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50))
    const status = searchParams.get('status')?.trim() || undefined
    const payments = await listPaymentsForUser(auth.user.id, { limit, status: status || null })
    return NextResponse.json({ payments })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

type PostBody = {
  amount?: number
  credits_added?: number
  transaction_content?: string
  bank_account?: string
  bank_name?: string
  qr_url?: string
}

/** POST: tạo giao dịch pending (QR). */
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    let body: PostBody
    try {
      body = (await request.json()) as PostBody
    } catch {
      return NextResponse.json({ error: 'JSON không hợp lệ.' }, { status: 400 })
    }

    const amount = Number(body.amount)
    const creditsAdded = Number(body.credits_added)
    const transactionContent = String(body.transaction_content ?? '').trim()
    const bankAccount = String(body.bank_account ?? '').trim()
    const bankName = String(body.bank_name ?? '').trim()
    const qrUrl = String(body.qr_url ?? '').trim()

    if (!Number.isFinite(amount) || amount < 1000) {
      return NextResponse.json({ error: 'Số tiền không hợp lệ.' }, { status: 400 })
    }
    if (!Number.isFinite(creditsAdded) || creditsAdded < 1) {
      return NextResponse.json({ error: 'Số credits không hợp lệ.' }, { status: 400 })
    }
    if (!transactionContent) {
      return NextResponse.json({ error: 'Thiếu nội dung chuyển khoản.' }, { status: 400 })
    }
    if (!bankAccount || !bankName) {
      return NextResponse.json({ error: 'Thiếu thông tin ngân hàng.' }, { status: 400 })
    }
    if (!qrUrl) {
      return NextResponse.json({ error: 'Thiếu qr_url.' }, { status: 400 })
    }

    const payment = await insertPendingPayment({
      userId: auth.user.id,
      amount,
      creditsAdded,
      transactionContent,
      bankAccount,
      bankName,
      qrUrl,
    })
    return NextResponse.json({ payment })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
