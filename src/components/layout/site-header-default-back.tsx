'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'

/** Nút Quay lại trên header cho mọi trang chưa tự gắn nút (slot công cụ tạo). */
export function SiteHeaderDefaultBackButton({
  label,
  initialPath,
}: {
  label: string
  initialPath: string
}) {
  const router = useRouter()
  const [pathname, setPathname] = useState(initialPath || '/')

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname || '/')
    sync()
    return subscribeToUrlChanges(sync)
  }, [])

  if (pathname === '/' || pathname === '') return null

  return (
    <button
      type="button"
      data-site-default-back=""
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-background text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-2.5"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push('/')
      }}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline" aria-hidden>
        {label}
      </span>
    </button>
  )
}
