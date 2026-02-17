'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const PRODUCTION_URL = 'https://nanoai.vn'

function getBaseUrl(): string {
  // 1. Host từ request – ưu tiên cao nhất
  try {
    const h = headers()
    if (h) {
      const host = h.get('host') ?? h.get('x-forwarded-host') ?? ''
      const proto = h.get('x-forwarded-proto') ?? h.get('x-forwarded-ssl') ?? 'http'
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        return `${proto === 'on' || proto === 'https' ? 'https' : proto}://${host}`.replace(/\/$/, '')
      }
    }
  } catch {
    /* ignore */
  }
  // 2. APP_URL (runtime)
  const appUrl = process.env.APP_URL
  if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')) {
    return appUrl.replace(/\/$/, '')
  }
  // 3. NEXT_PUBLIC_BASE_URL
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl
  }
  // 4. Hardcode production
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_URL
  }
  return envUrl ?? 'http://localhost:3000'
}

export async function login(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    redirect('/auth/login?error=Invalid request')
  }
  const supabase = createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/auth/login?error=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    redirect('/auth/login?error=Invalid request')
  }
  const supabase = createClient()

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
    redirect('/auth/login?error=Could not create user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = createClient()

  // Luôn dùng PRODUCTION_URL cho OAuth callback (tránh redirect về localhost)
  const baseUrl = getBaseUrl()
  const oauthRedirect = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
    ? baseUrl
    : PRODUCTION_URL
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${oauthRedirect}/auth/callback`,
    },
  })

  if (error) {
    redirect('/auth/login?error=Could not authenticate with Google')
  }

  if (data.url) {
    redirect(data.url)
  }
}


