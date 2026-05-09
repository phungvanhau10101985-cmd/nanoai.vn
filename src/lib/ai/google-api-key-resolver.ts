import { getEnabledUserAiApiKeyPlaintext } from '@/lib/db/user-ai-api-keys-pg'
import { getByokSubscriptionForUser } from '@/lib/db/user-ai-api-key-billing-pg'
import { GoogleGenerativeAI } from '@google/generative-ai'

export type ResolvedGoogleApiKey = {
  apiKey: string
  source: 'customer' | 'server'
}

export async function resolveGoogleApiKeyForUser(userId?: string | null): Promise<ResolvedGoogleApiKey | null> {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : null
  if (id) {
    try {
      const subscription = await getByokSubscriptionForUser(id)
      const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
      const subscriptionActive =
        subscription?.status === 'active' && periodEnd != null && !Number.isNaN(periodEnd.getTime()) && periodEnd > new Date()
      if (subscriptionActive) {
        const customerKey = await getEnabledUserAiApiKeyPlaintext(id, 'google_gemini')
        if (customerKey?.trim()) return { apiKey: customerKey.trim(), source: 'customer' }
      }
    } catch (e) {
      console.warn('[resolveGoogleApiKeyForUser] customer key unavailable, using server fallback:', e instanceof Error ? e.message : e)
    }
  }
  const serverKey = process.env.GOOGLE_API_KEY?.trim()
  if (serverKey) return { apiKey: serverKey, source: 'server' }
  return null
}

export async function requireGoogleApiKeyForUser(userId?: string | null): Promise<ResolvedGoogleApiKey> {
  const resolved = await resolveGoogleApiKeyForUser(userId)
  if (!resolved) throw new Error('Thiếu GOOGLE_API_KEY hoặc Gemini API key riêng hợp lệ.')
  return resolved
}

export async function createGoogleGenerativeAIForUser(userId?: string | null): Promise<GoogleGenerativeAI> {
  const { apiKey } = await requireGoogleApiKeyForUser(userId)
  return new GoogleGenerativeAI(apiKey)
}
