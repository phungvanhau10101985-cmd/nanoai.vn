'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  basePath: string
  hasActiveQuery: boolean
  sortBy: 'newest' | 'oldest' | 'drill_rate_desc' | 'drill_rate_asc'
  minRate: number
  shouldReset: boolean
}

const FILTER_STORAGE_KEY = 'admin_english_coach_filters_v1'

export function AdminFilterPersist({
  basePath,
  hasActiveQuery,
  sortBy,
  minRate,
  shouldReset,
}: Props) {
  const router = useRouter()

  useEffect(() => {
    if (shouldReset) {
      try {
        window.localStorage.removeItem(FILTER_STORAGE_KEY)
      } catch {
        // ignore localStorage errors
      }
      router.replace(basePath)
      return
    }

    if (hasActiveQuery) {
      try {
        window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ sortBy, minRate }))
      } catch {
        // ignore localStorage errors
      }
      return
    }

    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { sortBy?: string; minRate?: number }
      const savedSort = String(parsed.sortBy || '').trim()
      const savedMinRate = Number.isFinite(Number(parsed.minRate))
        ? Math.max(0, Math.min(100, Math.floor(Number(parsed.minRate))))
        : 0
      if (!savedSort && savedMinRate <= 0) return

      const params = new URLSearchParams()
      if (savedSort === 'newest' || savedSort === 'oldest' || savedSort === 'drill_rate_desc' || savedSort === 'drill_rate_asc') {
        params.set('sort', savedSort)
      }
      if (savedMinRate > 0) params.set('minRate', String(savedMinRate))
      const query = params.toString()
      if (query) router.replace(`${basePath}?${query}`)
    } catch {
      // ignore localStorage errors
    }
  }, [basePath, hasActiveQuery, minRate, router, shouldReset, sortBy])

  return null
}
