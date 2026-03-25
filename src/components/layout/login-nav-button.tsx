'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'

function buildLoginHref(): string {
  if (typeof window === 'undefined') return '/auth/login'
  const raw = `${window.location.pathname || '/'}${window.location.search || ''}`
  return `/auth/login?next=${encodeURIComponent(sanitizeLoginNext(raw))}`
}

/**
 * Không dùng `useSearchParams` / `usePathname` / Suspense — tránh Next chèn `<input>` và lỗi hydrate.
 */
export function LoginNavButton({ label, className }: { label: string; className?: string }) {
  const [href, setHref] = useState('/auth/login')

  useEffect(() => {
    const sync = () => setHref(buildLoginHref())
    sync()
    return subscribeToUrlChanges(sync)
  }, [])

  return (
    <Link href={href}>
      <Button variant="secondary" size="sm" className={className}>
        {label}
      </Button>
    </Link>
  )
}
