'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function WeddingLandingStickyCta(props: { href: string; label: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('wedding-landing-hero-cta')
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 z-30 border-t border-rose-100 bg-white/95 pl-3 pr-16 pt-3 shadow-[0_-8px_24px_rgba(120,53,15,0.08)] backdrop-blur bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] pb-3 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:hidden">
      <Button asChild className="h-12 min-h-12 w-full touch-manipulation rounded-full bg-rose-700 text-base text-white hover:bg-rose-800 active:scale-[0.99]">
        <Link href={props.href}>{props.label}</Link>
      </Button>
    </div>
  )
}
