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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rose-100 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(120,53,15,0.08)] backdrop-blur lg:hidden">
      <Button asChild className="h-12 w-full rounded-full bg-rose-700 text-base text-white hover:bg-rose-800">
        <Link href={props.href}>{props.label}</Link>
      </Button>
    </div>
  )
}
