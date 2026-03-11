import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Toaster } from '@/components/ui/toaster'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = buildMetadata({
  title: 'Quản trị',
  description: 'Quản trị hệ thống NanoAI.',
  path: '/admin',
  noIndex: true,
})

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <Toaster />
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Quản trị
      </Link>
      {children}
    </div>
  )
}
