'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserOrBypass } from '@/lib/auth'
import { buildTaskHubSnapshot, type TaskHubSnapshot } from './task-hub-snapshot'

export async function refreshTaskHubSnapshot(): Promise<
  { ok: true; data: TaskHubSnapshot } | { ok: false; error: 'unauthorized' }
> {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) return { ok: false, error: 'unauthorized' }
  const data = await buildTaskHubSnapshot(supabase, user.id)
  return { ok: true, data }
}
