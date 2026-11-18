'use client'

import { useEffect, useMemo, useState } from 'react'
import { NavHubLinkTile } from '@/components/layout/nav-hub-link-tile'
import { Input } from '@/components/ui/input'
import { FEATURE_USAGE_EVENT } from '@/lib/feature-usage-signal'
import { homepageRecentKeys, personalizeHomepageGroups } from '@/lib/home-feature-order'
import { readHubPickerRecentKeys, type HubFeatureUsageThread } from '@/lib/hub-chat/hub-feature-picker-rank'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { readFeatureVisitCounts, readRecentFeatureHrefs } from '@/lib/mobile-feature-dock'
import { NAV_GROUPS } from '@/lib/nav-config'

export function HomeFeatureGroups({
  locale,
  searchId = 'home-tool-search',
}: {
  locale: WebLocale
  searchId?: string
}) {
  const [uiLocale, setUiLocale] = useState(locale)
  const [sessionKeys, setSessionKeys] = useState<string[]>([])
  const [visitedHrefs, setVisitedHrefs] = useState<string[]>([])
  const [threads, setThreads] = useState<HubFeatureUsageThread[]>([])
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const t = useMemo(() => getDictionary(uiLocale), [uiLocale])
  const recentKeys = useMemo(
    () => homepageRecentKeys({ sessionKeys, threads, visitedHrefs, locale: uiLocale }),
    [sessionKeys, threads, uiLocale, visitedHrefs]
  )
  const groups = useMemo(
    () => personalizeHomepageGroups(NAV_GROUPS, recentKeys, visitCounts),
    [recentKeys, visitCounts]
  )
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return groups
    return groups
      .map((group) => {
        const groupTitle = t.navGroup[group.titleKey].toLocaleLowerCase()
        const groupMatches = groupTitle.includes(normalizedQuery)
        const links = groupMatches
          ? group.links
          : group.links.filter((item) => {
              const label = t.tool[item.labelKey].toLocaleLowerCase()
              const subMatches = item.subLinks?.some((sub) =>
                t.tool[sub.labelKey].toLocaleLowerCase().includes(normalizedQuery)
              )
              return label.includes(normalizedQuery) || Boolean(subMatches)
            })
        return { ...group, links }
      })
      .filter((group) => group.links.length > 0)
  }, [groups, normalizedQuery, t])

  useEffect(() => {
    setUiLocale(locale)
  }, [locale])

  useEffect(() => {
    let cancelled = false
    const sync = () => {
      setUiLocale(readWebLocaleFromDocumentCookie())
      setSessionKeys(readHubPickerRecentKeys())
      setVisitedHrefs(readRecentFeatureHrefs())
      setVisitCounts(readFeatureVisitCounts())
      void fetch('/api/hub-chat/threads', { credentials: 'same-origin' })
        .then(async (res) => {
          if (!res.ok) return null
          return (await res.json()) as { threads?: HubFeatureUsageThread[] }
        })
        .then((data) => {
          if (cancelled || !data) return
          setThreads(Array.isArray(data.threads) ? data.threads : [])
        })
        .catch(() => {
          /* icon vẫn xếp theo lần mở đã lưu trên máy */
        })
    }
    sync()
    window.addEventListener(FEATURE_USAGE_EVENT, sync)
    window.addEventListener('focus', sync)
    const unsubscribe = subscribeToUrlChanges(sync)
    return () => {
      cancelled = true
      window.removeEventListener(FEATURE_USAGE_EVENT, sync)
      window.removeEventListener('focus', sync)
      unsubscribe()
    }
  }, [])

  return (
    <>
      <div className="surface-card p-3 sm:p-4 md:p-5">
        <label className="mb-2 block text-base font-semibold text-slate-800 dark:text-slate-100 md:sr-only" htmlFor={searchId}>
          {t.app.toolHub}
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.app.homeSearchPlaceholder}
          aria-label={t.app.homeSearchPlaceholder}
          className="mt-2 h-11 text-base md:text-sm"
        />
      </div>
      {visibleGroups.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t.app.homeSearchEmpty}</p>
      ) : null}
      {visibleGroups.map((group, index) => (
        <div key={`${group.titleKey}-${index}`} className="surface-card p-3 sm:p-4 md:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 sm:text-base">
            <span className="h-1.5 w-9 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            {t.navGroup[group.titleKey]}
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-4 lg:gap-3 xl:grid-cols-5">
            {group.links.map((item) => (
              <NavHubLinkTile key={item.href} item={item} t={t} variant="surface" />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
