import { NextResponse } from 'next/server'
import { buildInventoryExportBuffer } from '@/lib/messaging/partner-inventory-excel'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: rows, error } = await gate.supabase
    .from('messaging_partner_inventory')
    .select('*')
    .eq('partner_id', partnerId)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const buf = buildInventoryExportBuffer(rows ?? [])
  const dateStr = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="kho-hang-export-${dateStr}.xlsx"`,
    },
  })
}
