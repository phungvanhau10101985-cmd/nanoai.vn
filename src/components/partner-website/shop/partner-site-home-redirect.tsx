'use client'

import { useLayoutEffect } from 'react'

/** Instant home navigation after the 404 chrome paints. */
export function PartnerSiteHomeRedirect({ href }: { href: string }) {
  useLayoutEffect(() => {
    const next = href.trim()
    if (!next) return
    window.location.replace(next)
  }, [href])
  return null
}
