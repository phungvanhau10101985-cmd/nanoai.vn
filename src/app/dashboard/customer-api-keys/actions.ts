'use server'

import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { encryptCustomerApiKey } from '@/lib/security/customer-api-key-vault'
import {
  deleteUserAiApiKey,
  getUserAiApiKeyPlaintext,
  getUserAiApiKeyPublicRow,
  updateUserAiApiKeyCheckStatus,
  updateUserAiApiKeyEnabled,
  upsertUserAiApiKey,
  type UserAiApiKeyPublicRow,
} from '@/lib/db/user-ai-api-keys-pg'
import {
  createByokPlanPayment,
  getByokPlanPaymentForUser,
  listByokPlanPaymentsForUser,
} from '@/lib/db/user-ai-api-key-billing-pg'
import { isByokPlanId, type ByokPlanId } from '@/lib/customer-api-keys/byok-plans'

const PROVIDER = 'google_gemini' as const
const PAGE_PATH = '/dashboard/customer-api-keys'

export async function getCustomerGeminiApiKeyStatusAction(): Promise<{
  row: UserAiApiKeyPublicRow | null
} | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const row = await getUserAiApiKeyPublicRow(auth.user.id, PROVIDER)
  return { row }
}

async function testGeminiApiKey(apiKey: string): Promise<{ ok: true } | { error: string }> {
  const key = apiKey.trim()
  if (!key) return { error: 'API key trống.' }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with exactly: ok' }] }],
        generationConfig: { maxOutputTokens: 4, temperature: 0 },
      }),
    }
  )
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    const message = raw ? raw.slice(0, 220) : `Gemini HTTP ${res.status}`
    return { error: message }
  }
  return { ok: true }
}

export async function saveCustomerGeminiApiKeyAction(apiKey: string): Promise<{ ok: true } | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const trimmed = apiKey.trim()
  if (trimmed.length < 20) return { error: 'API key quá ngắn.' }
  const test = await testGeminiApiKey(trimmed)
  const encrypted = encryptCustomerApiKey(trimmed)
  const saved = await upsertUserAiApiKey({
    userId: auth.user.id,
    provider: PROVIDER,
    encrypted,
    status: 'ok' in test ? 'valid' : 'invalid',
    lastError: 'error' in test ? test.error : null,
  })
  if ('error' in saved) return saved
  revalidatePath(PAGE_PATH)
  if ('error' in test) return { error: `Đã lưu key nhưng kiểm tra chưa thành công: ${test.error}` }
  return { ok: true }
}

export async function checkCustomerGeminiApiKeyAction(): Promise<{ ok: true } | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  let apiKey: string | null = null
  try {
    apiKey = await getUserAiApiKeyPlaintext(auth.user.id, PROVIDER)
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await updateUserAiApiKeyCheckStatus({ userId: auth.user.id, provider: PROVIDER, status: 'invalid', lastError: error })
    revalidatePath(PAGE_PATH)
    return { error }
  }
  if (!apiKey) return { error: 'Chưa có Gemini API key.' }
  const test = await testGeminiApiKey(apiKey)
  await updateUserAiApiKeyCheckStatus({
    userId: auth.user.id,
    provider: PROVIDER,
    status: 'ok' in test ? 'valid' : 'invalid',
    lastError: 'error' in test ? test.error : null,
  })
  revalidatePath(PAGE_PATH)
  return test
}

export async function setCustomerGeminiApiKeyEnabledAction(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const result = await updateUserAiApiKeyEnabled({ userId: auth.user.id, provider: PROVIDER, enabled })
  revalidatePath(PAGE_PATH)
  return result
}

export async function deleteCustomerGeminiApiKeyAction(): Promise<{ ok: true } | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const result = await deleteUserAiApiKey({ userId: auth.user.id, provider: PROVIDER })
  revalidatePath(PAGE_PATH)
  return result
}

export async function createByokPlanPaymentAction(planId: ByokPlanId) {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  if (!isByokPlanId(planId)) return { error: 'Gói BYOK không hợp lệ.' }
  try {
    const payment = await createByokPlanPayment({ userId: auth.user.id, planId })
    revalidatePath(PAGE_PATH)
    return { payment }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getByokPlanPaymentAction(paymentId: string) {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const id = String(paymentId || '').trim()
  if (!id) return { error: 'Thiếu payment id.' }
  const payment = await getByokPlanPaymentForUser(id, auth.user.id)
  if (!payment) return { error: 'Không tìm thấy giao dịch.' }
  return { payment }
}

export async function listByokPlanPaymentsAction() {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }
  const payments = await listByokPlanPaymentsForUser(auth.user.id, 10)
  return { payments }
}
