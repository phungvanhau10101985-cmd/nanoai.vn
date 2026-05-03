import { NextResponse } from 'next/server'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { buildInventoryExportBuffer } from '@/lib/messaging/partner-inventory-excel'
import { listPartnerInventoryRows } from '@/lib/messaging/partner-inventory-upsert-batch'
import { requireMessagingPartnerInventoryAccess } from '@/lib/messaging/partner-inventory-route-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerInventoryAccess(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const listed = await listPartnerInventoryRows(partnerId)
  if (!listed.ok) return NextResponse.json({ error: listed.error }, { status: 500 })
  const partners = await fetchMessagingPartnersByIdsFromPg([partnerId])
  const slug = partners?.[0]?.slug?.trim() ?? ''
  const buf = buildInventoryExportBuffer(listed.rows, { partnerChatSlug: slug })
  const dateStr = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="kho-hang-export-${dateStr}.xlsx"`,
    },
  })
}
