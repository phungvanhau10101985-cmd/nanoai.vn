import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { FORCE_REAL_LOGIN_COOKIE } from '@/lib/auth'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.auth.signOut()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
  const wasDevUser = isLocalhost && !user

  if (wasDevUser) {
    const res = NextResponse.redirect(new URL('/auth/login', request.url))
    res.cookies.set(FORCE_REAL_LOGIN_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 })
    return res
  }

  return redirect('/')
}
