'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function HomeworkHelpLandingStickyCta(props: { href: string; label: string; heroId?: string }) {
  const heroId = props.heroId ?? 'homework-landing-hero-cta'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById(heroId)
    if (!hero) return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0.35 })
    observer.observe(hero)
    return () => observer.disconnect()
  }, [heroId])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <Link
        href={props.href}
        className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
      >
        {props.label}
      </Link>
    </div>
  )
}
