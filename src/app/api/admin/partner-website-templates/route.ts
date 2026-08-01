import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import {
  fetchPartnerWebsitePlatformConfigPg,
  updatePartnerWebsitePlatformConfigPg,
  type PartnerWebsitePlatformConfig,
} from '@/lib/db/partner-website-platform-settings-pg'
import {
  PARTNER_WEBSITE_SECTION_REGISTRY,
  PARTNER_WEBSITE_TEMPLATE_DEFINITIONS,
} from '@/lib/partner-website/template/section-registry'

async function assertAdmin() {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const role = await getProfileRoleWithFallback(auth.user.id)
  if (role !== 'admin') return { ok: false as const, status: 403, error: 'Admin only' }
  return { ok: true as const }
}

export async function GET() {
  const gate = await assertAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const config = await fetchPartnerWebsitePlatformConfigPg()
  return NextResponse.json({
    config,
    templates: PARTNER_WEBSITE_TEMPLATE_DEFINITIONS,
    sections: PARTNER_WEBSITE_SECTION_REGISTRY,
  })
}

export async function PATCH(req: NextRequest) {
  const gate = await assertAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const body = (await req.json()) as { config?: PartnerWebsitePlatformConfig }
  if (!body.config?.enabledSectionTypes?.length) {
    return NextResponse.json({ error: 'config.enabledSectionTypes required' }, { status: 400 })
  }

  const saved = await updatePartnerWebsitePlatformConfigPg(body.config)
  if (!saved) {
    return NextResponse.json({ error: 'Could not save platform config' }, { status: 500 })
  }
  return NextResponse.json({ success: true, config: saved })
}
