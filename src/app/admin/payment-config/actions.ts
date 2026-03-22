'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const DEFAULT_QR_TEMPLATE_URL =
  'https://qr.sepay.vn/img?acc={bank_acc}&bank={bank_id}&amount={amount}&des={content}'

export type PaymentConfigRow = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name: string | null
  qr_template_url: string
  is_active: boolean | null
  created_at: string | null
}

function adminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin(): Promise<{ user: { id: string } } | { error: string }> {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }
  return { user }
}

export async function listPaymentConfigsAction(): Promise<
  { data: PaymentConfigRow[] } | { error: string }
> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }
  const admin = adminServiceClient()
  if (!admin) {
    return { error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.' }
  }
  const { data, error } = await admin
    .from('payment_configs')
    .select('id, bank_account, bank_id, bank_name, account_holder_name, qr_template_url, is_active, created_at')
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }
  return { data: (data ?? []) as PaymentConfigRow[] }
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
  const admin = adminServiceClient()
  if (!admin) {
    return { error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.' }
  }

  const bank_account = String(input.bank_account || '').trim()
  const bank_id = String(input.bank_id || '').trim()
  const bank_name = String(input.bank_name || '').trim()
  if (!bank_account || !bank_id || !bank_name) {
    return { error: 'bank_required' }
  }

  const qr_template_url = String(input.qr_template_url || '').trim() || DEFAULT_QR_TEMPLATE_URL
  const account_holder_name = String(input.account_holder_name || '').trim() || null
  const is_active = input.is_active !== false

  if (input.id) {
    const { error } = await admin
      .from('payment_configs')
      .update({
        bank_account,
        bank_id,
        bank_name,
        account_holder_name,
        qr_template_url,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('payment_configs').insert({
      bank_account,
      bank_id,
      bank_name,
      account_holder_name,
      qr_template_url,
      is_active,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/payment-config')
  return { ok: true }
}

export async function deletePaymentConfigAction(id: string): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }
  const admin = adminServiceClient()
  if (!admin) {
    return { error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.' }
  }
  const { error } = await admin.from('payment_configs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/payment-config')
  return { ok: true }
}
