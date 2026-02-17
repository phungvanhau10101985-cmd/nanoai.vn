import { createClient } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

const FORCE_REAL_LOGIN_COOKIE = 'force_real_login'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  const { data: { session } } = await supabase.auth.getSession() // Refresh session for Server Components
  if (session) {
    response.cookies.set(FORCE_REAL_LOGIN_COOKIE, '', { path: '/', maxAge: 0 })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico, images
     * - /api/* (API routes, webhook - không cần auth session)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
