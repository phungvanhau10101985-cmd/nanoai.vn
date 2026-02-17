'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function updateUserCredit(userId: string, newBalance: number) {
  const supabase = createClient()

  // Security Check: Ensure the current user is an admin before proceeding
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }

  // Update the user's credit balance
  const { error } = await supabase
    .from('credits')
    .update({ balance: newBalance })
    .eq('user_id', userId)

  if (error) {
    return { error: 'Failed to update credit balance.' }
  }

  revalidatePath('/admin/users') // Refresh the admin page
  return { success: true }
}
