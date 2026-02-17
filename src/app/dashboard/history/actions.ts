'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function deleteHistoryItem(id: string) {
  const supabase = createClient()
  
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Unauthorized')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { error } = await supabase
    .from('try_on_history')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting history item:', error)
    return { error: 'Failed to delete item' }
  }

  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/history/translate')
  return { success: true }
}
