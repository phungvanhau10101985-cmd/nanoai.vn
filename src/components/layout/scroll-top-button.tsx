'use client'

import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'

const SCROLL_SHOW_PX = 320

function topLabel(locale: string): string {
  if (locale === 'en') return 'Back to top'
  if (locale === 'zh') return '回到顶部'
  if (locale === 'ja') return 'ページ上部へ'
  if (locale === 'ko') return '맨 위로'
  return 'Lên đầu trang'
}

/** Nút Top dưới icon chat NanoAI. Hiện khi đã kéo xuống. */
export function ScrollTopButton() {
  const locale = useWebLocaleFromDocumentCookie()
  const [visible, setVisible] = useState(false)
  const label = topLabel(locale)

  useEffect(() => {
    let frame = 0
    const sync = () => {
      frame = 0
      const y = window.scrollY || document.documentElement.scrollTop || 0
      setVisible(y > SCROLL_SHOW_PX)
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(sync)
    }
    sync()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      className="fixed bottom-[7.25rem] right-3 z-[2147482990] flex h-11 w-11 items-center justify-center rounded-full border border-border/40 bg-background/95 text-foreground shadow-lg transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-4"
      aria-label={label}
      title={label}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </button>
  )
}
