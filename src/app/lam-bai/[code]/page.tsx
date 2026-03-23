import LamBaiClientPage from './lam-bai-client-page'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerDictionary } from '@/lib/i18n/server'

export default async function LamBaiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    redirect(`/auth/force-login?next=${encodeURIComponent(`/lam-bai/${code}`)}`)
  }
  const { t } = await getServerDictionary()
  return <LamBaiClientPage code={code} t={t.classes} />
}
