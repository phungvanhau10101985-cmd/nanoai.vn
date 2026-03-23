'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

function LoginNavButtonInner({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const q = searchParams.toString()
  const raw = q ? `${pathname}?${q}` : pathname
  const next = sanitizeLoginNext(raw)
  return (
    <Link href={`/auth/login?next=${encodeURIComponent(next)}`}>
      <Button variant="secondary" size="sm" className={className}>
        {label}
      </Button>
    </Link>
  )
}

/** Nút đăng nhập header — gắn `next` = trang hiện tại để sau đăng nhập quay lại. */
export function LoginNavButton({ label, className }: { label: string; className?: string }) {
  return (
    <Suspense
      fallback={
        <Link href="/auth/login">
          <Button variant="secondary" size="sm" className={className}>
            {label}
          </Button>
        </Link>
      }
    >
      <LoginNavButtonInner label={label} className={className} />
    </Suspense>
  )
}
