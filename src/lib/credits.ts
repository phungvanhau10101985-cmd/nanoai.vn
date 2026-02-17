'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

/** Lấy số dư credits của user đăng nhập (dùng chung cho tất cả công cụ). */
export async function getCredits(): Promise<number> {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return 0
  const { user } = result
  const { data } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  return data?.balance ?? 0
}
