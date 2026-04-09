import { NextResponse } from 'next/server'
import { listActivePaymentConfigs } from '@/lib/db/payments-repo'

export const dynamic = 'force-dynamic'

/** GET: cấu hình ngân hàng đang bật (public, chỉ field hiển thị QR). */
export async function GET() {
  try {
    const configs = await listActivePaymentConfigs()
    return NextResponse.json({ configs })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
