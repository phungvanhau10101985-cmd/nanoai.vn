'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const CREDIT_PACKAGES = [
  { id: 1, credits: 10, price: 50000 },
  { id: 2, credits: 25, price: 100000 },
  { id: 3, credits: 60, price: 200000 },
]

export async function createDepositTransaction(packageId: number) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'You must be logged in to make a deposit.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const selectedPackage = CREDIT_PACKAGES.find((p) => p.id === packageId)

  if (!selectedPackage) {
    return { error: 'Invalid credit package selected.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      amount: selectedPackage.price,
      type: 'deposit',
      status: 'pending',
      description: `${selectedPackage.credits} credits package`,
    })
    .select()
    .single()

  if (error) {
    return { error: 'Could not create transaction. Please try again.' }
  }

  revalidatePath('/wallet')
  return { transactionId: data.id }
}
