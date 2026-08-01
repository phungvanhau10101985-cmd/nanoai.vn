'use client'

import { useMemo, useState } from 'react'
import { Monitor, Smartphone, Tablet, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { getPartnerWebsiteQuickEdits } from '@/lib/partner-website/partner-website-quick-edits'

export type PartnerWebsitePreviewDevice = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTH: Record<PartnerWebsitePreviewDevice, number | 'full'> = {
  desktop: 'full',
  tablet: 768,
  mobile: 390,
}

export function PartnerWebsiteDevicePreview({
  locale,
  partnerId,
  previewVersion,
  publicUrl,
  siteSlug,
  hasWebsite,
  embedded = false,
  onQuickEdit,
  quickEditDisabled = false,
}: {
  locale: WebLocale
  partnerId: string
  /** Bump after generate/publish to refresh iframe */
  previewVersion: string
  publicUrl?: string | null
  siteSlug?: string
  hasWebsite: boolean
  /** Smaller iframe when rendered inside the publish column */
  embedded?: boolean
  onQuickEdit?: (prompt: string) => void
  quickEditDisabled?: boolean
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [device, setDevice] = useState<PartnerWebsitePreviewDevice>('desktop')
  const quickEdits = useMemo(() => getPartnerWebsiteQuickEdits(locale, t), [locale, t])

  const previewSrc = useMemo(() => {
    if (!partnerId || !hasWebsite) return null
    const v = encodeURIComponent(previewVersion || '0')
    return `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`
  }, [partnerId, hasWebsite, previewVersion])

  const frameWidth = DEVICE_WIDTH[device]

  if (!hasWebsite || !previewSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground',
          embedded ? 'min-h-[360px] flex-1' : 'min-h-[320px]'
        )}
      >
        {t.previewEmpty}
      </div>
    )
  }

  const iframeClass = embedded
    ? device === 'desktop'
      ? 'min-h-[420px] flex-1'
      : 'min-h-[480px] h-[min(58vh,680px)]'
    : device === 'desktop'
      ? 'min-h-[520px] h-[min(72vh,640px)]'
      : 'min-h-[560px] h-[640px]'

  return (
    <div className={cn('space-y-3', embedded && 'flex min-h-0 flex-1 flex-col')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{t.previewTitle}</p>
        <div className="flex flex-wrap items-center gap-1">
          {onQuickEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2 text-xs"
                  disabled={quickEditDisabled}
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  {t.quickEditButton}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {quickEdits.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    disabled={quickEditDisabled}
                    onClick={() => onQuickEdit(item.prompt)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={device === 'desktop' ? 'default' : 'outline'}
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden />
            {t.viewDesktop}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'tablet' ? 'default' : 'outline'}
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => setDevice('tablet')}
          >
            <Tablet className="h-3.5 w-3.5" aria-hidden />
            {t.viewTablet}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'mobile' ? 'default' : 'outline'}
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            {t.viewMobile}
          </Button>
        </div>
      </div>

      <div className={cn('overflow-auto rounded-lg border bg-muted/30 p-3', embedded && 'flex min-h-0 flex-1 flex-col')}>
        <div
          className={cn(
            'mx-auto flex flex-col overflow-hidden rounded-md border bg-white shadow-sm transition-[width] duration-200',
            device === 'desktop' ? 'h-full w-full flex-1' : ''
          )}
          style={frameWidth === 'full' ? undefined : { width: frameWidth, maxWidth: '100%' }}
        >
          <iframe
            key={previewSrc}
            title={t.previewTitle}
            src={previewSrc}
            className={cn('block w-full border-0 bg-white', iframeClass)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        </div>
      </div>

      {publicUrl ? (
        <p className="text-xs text-muted-foreground">
          {t.previewPublicLink}:{' '}
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
            {publicUrl}
          </a>
        </p>
      ) : siteSlug ? (
        <p className="text-xs text-muted-foreground">{t.publishToView}</p>
      ) : null}
    </div>
  )
}
