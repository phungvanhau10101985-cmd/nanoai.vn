import { NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { getUserAiApiKeyPublicRow } from '@/lib/db/user-ai-api-keys-pg'
import { getByokSubscriptionForUser, listByokPlanPaymentsForUser } from '@/lib/db/user-ai-api-key-billing-pg'

export async function GET() {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const row = await getUserAiApiKeyPublicRow(auth.user.id, 'google_gemini')
  const subscription = await getByokSubscriptionForUser(auth.user.id)
  const payments = await listByokPlanPaymentsForUser(auth.user.id, 5)
  return NextResponse.json({ row, subscription, payments })
}
