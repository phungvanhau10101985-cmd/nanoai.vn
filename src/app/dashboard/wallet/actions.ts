'use server'

import { getUserForAction } from '@/lib/auth'
import { insertPendingDepositTransaction } from '@/lib/db/transactions-repo'
import { revalidatePath } from 'next/cache'

const CREDIT_PACKAGES = [
  { id: 1, credits: 10, price: 50000 },
  { id: 2, credits: 25, price: 100000 },
  { id: 3, credits: 60, price: 200000 },
]

export async function createDepositTransaction(packageId: number) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const selectedPackage = CREDIT_PACKAGES.find((p) => p.id === packageId)

  if (!selectedPackage) {
    return { error: 'Invalid credit package selected.' }
  }

  const out = await insertPendingDepositTransaction({
    userId: user.id,
    amount: selectedPackage.price,
    description: `${selectedPackage.credits} credits package`,
  })

  if ('error' in out) {
    return { error: 'Could not create transaction. Please try again.' }
  }

  revalidatePath('/wallet')
  return { transactionId: out.id }
}

