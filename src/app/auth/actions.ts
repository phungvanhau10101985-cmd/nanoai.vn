'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseMutableCookiesClient } from '@/lib/supabase/mutable-cookies-client'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

const PRODUCTION_URL = 'https://nanoai.vn'

function getBaseUrl(): string {
  // 1. Host từ request — luôn dùng đúng origin đang mở (kể cả localhost).
  // Trước đây bỏ qua localhost rồi rơi xuống APP_URL=nanoai.vn → redirectTo OAuth sai domain,
  // cookie PKCE ở localhost nhưng callback về production → không đăng nhập được trên dev.
  try {
    const h = headers()
    if (h) {
      const host = (h.get('host') ?? h.get('x-forwarded-host') ?? '').trim()
      if (host) {
        const xfProto = (h.get('x-forwarded-proto') ?? h.get('x-forwarded-ssl') ?? '')
          .toLowerCase()
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
        const scheme =
          xfProto === 'https' || xfProto === 'on'
            ? 'https'
            : xfProto === 'http'
              ? 'http'
              : isLocal
                ? 'http'
                : 'https'
        return `${scheme}://${host}`.replace(/\/$/, '')
      }
    }
  } catch {
    /* ignore */
  }
  // 2. APP_URL (runtime) — khi không đọc được Host (hiếm)
  const appUrl = process.env.APP_URL
  if (appUrl?.trim()) {
    return appUrl.replace(/\/$/, '')
  }
  // 3. NEXT_PUBLIC_BASE_URL
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (envUrl) {
    return envUrl.replace(/\/$/, '')
  }
  // 4. Hardcode production
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_URL
  }
  return 'http://localhost:3000'
}

function nextQueryFromForm(formData: FormData): string {
  const raw = String(formData.get('next') ?? '').trim()
  if (!raw) return ''
  return `&next=${encodeURIComponent(sanitizeLoginNext(raw))}`
}

export async function login(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    redirect('/auth/login?error=Invalid request')
  }
  const supabase = createSupabaseMutableCookiesClient()
  const nq = nextQueryFromForm(formData)

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/auth/login?error=Could not authenticate user${nq}`)
  }

  revalidatePath('/', 'layout')
  redirect(sanitizeLoginNext(String(formData.get('next') ?? '')))
}

export async function signup(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    redirect('/auth/login?error=Invalid request')
  }
  const supabase = createSupabaseMutableCookiesClient()
  const nq = nextQueryFromForm(formData)

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    redirect(`/auth/login?error=Could not create user${nq}`)
  }

  revalidatePath('/', 'layout')
  redirect(sanitizeLoginNext(String(formData.get('next') ?? '')))
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = createSupabaseMutableCookiesClient()
  const nextPath = sanitizeLoginNext(String(formData.get('next') ?? ''))

  // Callback phải cùng origin với trang đang đăng nhập (cookie PKCE/code-verifier theo domain).
  // Ép PRODUCTION_URL khi không phải localhost từng làm lệch www / staging / preview → đổi mã lỗi, không có phiên.
  let oauthRedirect = getBaseUrl().replace(/\/$/, '')
  if (
    process.env.NODE_ENV === 'production' &&
    (oauthRedirect.includes('localhost') || oauthRedirect.includes('127.0.0.1'))
  ) {
    oauthRedirect = (process.env.APP_URL || PRODUCTION_URL).replace(/\/$/, '')
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${oauthRedirect}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error) {
    const nq = nextQueryFromForm(formData)
    redirect(`/auth/login?error=Could not authenticate with Google${nq}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}


