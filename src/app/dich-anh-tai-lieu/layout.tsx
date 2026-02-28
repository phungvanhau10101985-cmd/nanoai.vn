import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'

export default async function DichAnhTaiLieuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  return (
    <div className="app-shell">
      {children}
    </div>
  )
}
