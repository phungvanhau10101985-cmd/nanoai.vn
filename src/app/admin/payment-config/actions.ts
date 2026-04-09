'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import {
  deletePaymentConfigPg,
  listPaymentConfigsAllFromPg,
  upsertPaymentConfigPg,
  type PaymentConfigAdminRow,
} from '@/lib/db/payments-repo'
import { isPgConfigured } from '@/lib/db/pool'

const DEFAULT_QR_TEMPLATE_URL =
  'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}'

export type PaymentConfigRow = PaymentConfigAdminRow

async function requireAdmin(): Promise<{ user: { id: string } } | { error: string }> {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }
  return { user }
}

export async function listPaymentConfigsAction(): Promise<
  { data: PaymentConfigRow[] } | { error: string }
> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }
  const data = await listPaymentConfigsAllFromPg()
  if (data === null) {
    return { error: 'Không đọc được danh sách tài khoản ngân hàng.' }
  }
  return { data }
}

export type SavePaymentConfigInput = {
  id?: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name?: string
  qr_template_url?: string
  is_active?: boolean
}

export async function savePaymentConfigAction(
  input: SavePaymentConfigInput
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const bank_account = String(input.bank_account || '').trim()
  const bank_id = String(input.bank_id || '').trim()
  const bank_name = String(input.bank_name || '').trim()
  if (!bank_account || !bank_id || !bank_name) {
    return { error: 'bank_required' }
  }

  const qr_template_url = String(input.qr_template_url || '').trim() || DEFAULT_QR_TEMPLATE_URL
  const account_holder_name = String(input.account_holder_name || '').trim() || null
  const is_active = input.is_active !== false

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }

  const result = await upsertPaymentConfigPg({
    id: input.id,
    bank_account,
    bank_id,
    bank_name,
    account_holder_name,
    qr_template_url,
    is_active,
  })
  if ('error' in result) return { error: result.error }
  revalidatePath('/admin/payment-config')
  return { ok: true }
}

export async function deletePaymentConfigAction(id: string): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }
  const result = await deletePaymentConfigPg(id)
  if ('error' in result) return { error: result.error }
  revalidatePath('/admin/payment-config')
  return { ok: true }
}
