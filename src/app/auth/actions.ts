'use server'

import { redirect } from 'next/navigation'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

function nextQueryFromForm(formData: FormData): string {
  const raw = String(formData.get('next') ?? '').trim()
  if (!raw) return ''
  return `&next=${encodeURIComponent(sanitizeLoginNext(raw))}`
}

export async function login(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  redirect(`/auth/login?error=${encodeURIComponent('Đăng nhập bằng email (OTP) trên trang đăng nhập.')}${nq}`)
}

export async function signup(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  redirect(`/auth/login?error=${encodeURIComponent('Đăng ký qua email (OTP) trên trang đăng nhập.')}${nq}`)
}

export async function signInWithGoogle(formData: FormData) {
  const nq = formData && typeof formData.get === 'function' ? nextQueryFromForm(formData) : ''
  redirect(`/auth/login?error=${encodeURIComponent('Google đã tắt — chỉ đăng nhập bằng email (OTP).')}${nq}`)
}
