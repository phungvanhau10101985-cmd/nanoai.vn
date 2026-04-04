import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import type { Database } from '@/types/database.types'

export async function requireMessagingPartnerOwner(partnerId: string): Promise<
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }
  | { ok: false; error: string; status: number }
> {
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in auth) return { ok: false, error: auth.error, status: 401 }

  const { data, error } = await supabase
    .from('messaging_partners')
    .select('id')
    .eq('id', partnerId)
    .eq('owner_user_id', auth.user.id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!data) return { ok: false, error: 'Forbidden.', status: 403 }

  return { ok: true, supabase, userId: auth.user.id }
}
