import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export async function requireTaxonomyPartner(partnerId: string) {
  if (!isPgConfigured()) {
    return { error: NextResponse.json({ error: 'Database not configured' }, { status: 503 }) }
  }
  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) {
    return { error: NextResponse.json({ error: access.error }, { status: access.status }) }
  }
  return { partnerId: pid }
}

export function jsonTaxonomyError(message: string, status = 400) {
  return NextResponse.json({ error: message, detail: message }, { status })
}

export async function taxonomyFileBuffer(req: NextRequest): Promise<
  { buffer: Buffer; filename: string } | { error: NextResponse }
> {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return { error: jsonTaxonomyError('file required') }
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
    return { error: jsonTaxonomyError('Chỉ chấp nhận file .xlsx hoặc .xls') }
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: jsonTaxonomyError('File quá lớn (tối đa 20MB)') }
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), filename: file.name }
}
