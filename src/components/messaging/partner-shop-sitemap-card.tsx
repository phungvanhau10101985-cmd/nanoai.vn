'use client'

import { useState } from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  Globe,
  AlertCircle,
  FileCode2,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SettingsDataRoleBox } from '@/components/messaging/settings-data-role'
import {
  settingsDataRoleCopy,
  type SettingsDataRoleCopy,
} from '@/lib/messaging/settings-data-role'
import {
  buildPartnerSiteSitemapUrl,
  buildPartnerSiteSitemapPagesUrl,
  buildPartnerSiteSitemapProductsUrl,
  buildGoogleSearchConsoleSitemapsUrl,
} from '@/lib/messaging/partner-public-url'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

export interface PartnerShopSitemapCardProps {
  partnerId: string
  partnerSlug?: string
  siteSlug: string | null
  sitePublished: boolean
  publicUrl: string | null
  appOrigin?: string
  t: Dictionary['partnerMessaging']
  roleCopy?: SettingsDataRoleCopy
  className?: string
}

export function PartnerShopSitemapCard({
  siteSlug,
  sitePublished,
  publicUrl,
  appOrigin,
  t,
  roleCopy,
  className,
}: PartnerShopSitemapCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const activeRoleCopy = roleCopy || settingsDataRoleCopy(t)

  // Determine effective site URL
  let siteUrl = ''
  if (publicUrl?.trim()) {
    siteUrl = publicUrl.trim()
  } else if (siteSlug?.trim()) {
    const origin = (appOrigin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
    if (origin) {
      siteUrl = `${origin}/site/${encodeURIComponent(siteSlug.trim())}`
    }
  }

  const sitemapIndexUrl = siteUrl ? buildPartnerSiteSitemapUrl(siteUrl) : ''
  const sitemapPagesUrl = siteUrl ? buildPartnerSiteSitemapPagesUrl(siteUrl) : ''
  const sitemapProductsUrl = siteUrl ? buildPartnerSiteSitemapProductsUrl(siteUrl, 1) : ''
  const gscSitemapsUrl = siteUrl ? buildGoogleSearchConsoleSitemapsUrl(siteUrl) : 'https://search.google.com/search-console/sitemaps'

  const handleCopy = async (text: string, key: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev))
      }, 2000)
    } catch {
      // Fallback if clipboard API is restricted
    }
  }

  return (
    <Card className={cn('border-zinc-200 shadow-sm dark:border-zinc-800', className)}>
      <CardHeader className="space-y-1.5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-400">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{t.shopSitemapTitle}</CardTitle>
              <CardDescription className="text-xs">{t.shopSitemapHint}</CardDescription>
            </div>
          </div>
          <div>
            {sitePublished ? (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <CheckCircle2 className="h-3 w-3" />
                {t.shopSitemapReadyBadge}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <AlertCircle className="h-3 w-3" />
                {t.shopSitemapDraftBadge}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {!sitePublished ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium">{t.shopSitemapDraftWarning}</p>
            </div>
          </div>
        ) : null}

        {/* Primary Sitemap Index Box (Issued role) */}
        <SettingsDataRoleBox role="issued" copy={activeRoleCopy}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t.shopSitemapIndexUrlLabel}
              </label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleCopy('sitemap.xml', 'short')}
                >
                  {copiedKey === 'short' ? (
                    <Check className="mr-1 h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  {t.shopSitemapCopyPath}
                </Button>
                {sitemapIndexUrl ? (
                  <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                    <a href={sitemapIndexUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {t.shopSitemapViewXml}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  readOnly
                  value={sitemapIndexUrl || '—'}
                  className="h-9 bg-zinc-50/70 pl-8 font-mono text-xs dark:bg-zinc-900/50"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={() => handleCopy(sitemapIndexUrl, 'full')}
                disabled={!sitemapIndexUrl}
              >
                {copiedKey === 'full' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{t.shopSitemapCopyFullUrl}</span>
              </Button>
            </div>

            <div className="pt-1">
              <Button
                asChild
                size="sm"
                className="h-9 w-full gap-2 font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm sm:w-auto"
              >
                <a href={gscSitemapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t.shopSitemapOpenGsc}
                </a>
              </Button>
            </div>
          </div>
        </SettingsDataRoleBox>

        {/* Sub-sitemaps information */}
        {sitemapPagesUrl ? (
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="mb-2 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              {t.shopSitemapSubfilesLabel}
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1 rounded border border-zinc-200/60 bg-white px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <code className="font-mono font-medium text-sky-700 dark:text-sky-300">sitemap-pages.xml</code>
                  <span className="text-[11px] text-muted-foreground">— {t.shopSitemapPagesLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => handleCopy(sitemapPagesUrl, 'pages')}
                  >
                    {copiedKey === 'pages' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                    <a href={sitemapPagesUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1 rounded border border-zinc-200/60 bg-white px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <code className="font-mono font-medium text-sky-700 dark:text-sky-300">sitemap-products/1</code>
                  <span className="text-[11px] text-muted-foreground">— {t.shopSitemapProductsLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px]"
                    onClick={() => handleCopy(sitemapProductsUrl, 'products')}
                  >
                    {copiedKey === 'products' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                    <a href={sitemapProductsUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Submission instructions */}
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-400">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
            {t.shopSitemapInstructionsTitle}
          </p>
          <ol className="list-decimal space-y-1 pl-4 leading-relaxed">
            <li>{t.shopSitemapStep1}</li>
            <li>
              {t.shopSitemapStep2}{' '}
              <button
                type="button"
                onClick={() => handleCopy('sitemap.xml', 'inst-short')}
                className="inline-flex items-center gap-1 rounded bg-zinc-200/70 px-1 py-0.5 font-mono font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100"
              >
                sitemap.xml
                {copiedKey === 'inst-short' ? (
                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                ) : (
                  <Copy className="h-2.5 w-2.5" />
                )}
              </button>
            </li>
            <li>{t.shopSitemapStep3}</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
