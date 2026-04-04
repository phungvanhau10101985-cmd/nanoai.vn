import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'
import { parseVisionPurgeUploadToTokens } from '@/lib/messaging/partner-vision-purge-file'
import { parseVisionCatalogPurgeLines, runVisionCatalogPurgeFromTokens } from '@/lib/messaging/partner-vision-product-search'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await requireMessagingPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const db = createServiceRoleClient()
  const { data: settings, error } = await db
    .from('messaging_partner_ai_settings')
    .select('*')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!settings) {
    return NextResponse.json({ error: 'Save AI settings once before purging the image catalog.' }, { status: 400 })
  }

  const ct = req.headers.get('content-type') ?? ''
  let tokens: string[] = []
  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (file instanceof File) {
        tokens = await parseVisionPurgeUploadToTokens(file)
      }
    } else {
      let raw = ''
      if (ct.includes('application/json')) {
        const j = (await req.json()) as { text?: unknown }
        raw = typeof j?.text === 'string' ? j.text : ''
      } else {
        raw = await req.text()
      }
      tokens = parseVisionCatalogPurgeLines(raw)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        error:
          'No lines to process. Use .txt/.csv (one UUID or SKU per line) or Excel .xlsx/.xls — column A of the first sheet.',
      },
      { status: 400 }
    )
  }

  const r = await runVisionCatalogPurgeFromTokens(db, partnerId, settings, tokens)
  if ('error' in r) {
    return NextResponse.json({ error: r.error }, { status: 400 })
  }
  revalidatePath('/dashboard/messaging')
  return NextResponse.json(r)
}
