import LamBaiClientPage from './lam-bai-client-page'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LamBaiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) {
    redirect(`/auth/force-login?next=${encodeURIComponent(`/lam-bai/${code}`)}`)
  }
  return <LamBaiClientPage code={code} />
}
