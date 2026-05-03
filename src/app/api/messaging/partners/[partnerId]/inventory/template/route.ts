import { NextResponse } from 'next/server'
import { buildInventoryTemplateBuffer } from '@/lib/messaging/partner-inventory-excel'
import { requireMessagingPartnerInventoryAccess } from '@/lib/messaging/partner-inventory-route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerInventoryAccess(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const buf = buildInventoryTemplateBuffer()
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mau-danh-sach-kho-hang.xlsx"',
    },
  })
}
