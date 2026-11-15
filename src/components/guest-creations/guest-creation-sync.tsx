'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { installGuestCreationSync } from '@/lib/guest-creations/guest-creation-sync'

/** Khách chưa đăng nhập: giữ bản tạo trong trình duyệt. Vừa đăng nhập: đổ vào tài khoản. */
export function GuestCreationSync() {
  const router = useRouter()
  useEffect(() => installGuestCreationSync(() => router.refresh()), [router])
  return null
}
