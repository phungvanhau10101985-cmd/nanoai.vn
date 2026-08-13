'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Laptop, Monitor, Smartphone, Tablet, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { applyThemeCssVarsToDocument } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { PartnerWebsiteVisualEditorToolbar } from '@/components/partner-website/partner-website-visual-editor-toolbar'

export type PartnerWebsitePreviewDevice = 'mobile' | 'tablet' | 'laptop' | 'desktop'

const DEVICE_WIDTH: Record<PartnerWebsitePreviewDevice, number | 'full'> = {
  mobile: 390,
  tablet: 768,
  laptop: 1280,
  desktop: 'full',
}

export function PartnerWebsiteDevicePreview({
  locale,
  partnerId,
  previewVersion,
  liveTheme,
  publicUrl,
  siteSlug,
  hasWebsite,
  embedded = false,
  quickEditDisabled = false,
  visualEditEnabled = false,
  websiteTitle,
  project,
  onVisualEditSave,
  onVisualEditError,
}: {
  locale: WebLocale
  partnerId: string
  /** Bump after generate/publish to refresh iframe */
  previewVersion: string
  liveTheme?: PartnerWebsiteTheme | null
  publicUrl?: string | null
  siteSlug?: string
  hasWebsite: boolean
  /** Smaller iframe when rendered inside the publish column */
  embedded?: boolean
  /** @deprecated AI prompt quick-edits removed — use visual edit */
  onQuickEdit?: (prompt: string) => void
  quickEditDisabled?: boolean
  /** Enable direct visual edit on preview (template + legacy) */
  visualEditEnabled?: boolean
  websiteTitle?: string
  project?: PartnerWebsiteProject | null
  onVisualEditSave?: (project: PartnerWebsiteProject) => Promise<void>
  onVisualEditError?: (message: string) => void
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [device, setDevice] = useState<PartnerWebsitePreviewDevice>('desktop')
  const [visualEditActive, setVisualEditActive] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const projectRef = useRef<PartnerWebsiteProject | null>(null)
  projectRef.current = project ?? null

  const previewSrc = useMemo(() => {
    if (!partnerId || !hasWebsite) return null
    const v = encodeURIComponent(previewVersion || '0')
    return `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`
  }, [partnerId, hasWebsite, previewVersion])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !liveTheme) return
    const apply = () => {
      try {
        const doc = iframe.contentDocument
        if (doc?.documentElement) applyThemeCssVarsToDocument(doc, liveTheme)
      } catch {
        /* cross-origin preview */
      }
    }
    apply()
    iframe.addEventListener('load', apply)
    return () => iframe.removeEventListener('load', apply)
  }, [liveTheme, previewSrc])

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
    ? device === 'desktop' || device === 'laptop'
      ? 'min-h-[calc(100dvh-11rem)] h-full flex-1'
      : 'min-h-[calc(100dvh-11rem)] h-full flex-1'
    : device === 'desktop' || device === 'laptop'
      ? device === 'laptop'
        ? 'min-h-[calc(100dvh-12rem)] h-[min(78vh,900px)]'
        : 'min-h-[calc(100dvh-12rem)] h-[min(80vh,960px)]'
      : 'min-h-[640px] h-[min(78vh,860px)]'

  const canVisualEdit = visualEditEnabled && Boolean(onVisualEditSave)

  return (
    <div className={cn('space-y-2', embedded && 'flex min-h-0 flex-1 flex-col')}>
      <div className={cn('flex flex-wrap items-center gap-2', !embedded && 'justify-between')}>
        {embedded ? null : <p className="text-sm font-medium">{t.previewTitle}</p>}
        <div className={cn('flex flex-wrap items-center gap-1', embedded && 'w-full justify-end')}>
          {canVisualEdit ? (
            <Button
              type="button"
              size="sm"
              variant={visualEditActive ? 'default' : 'outline'}
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={quickEditDisabled}
              onClick={() => setVisualEditActive((v) => !v)}
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              {t.quickEditButton}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={device === 'mobile' ? 'default' : 'outline'}
            className="h-7 gap-1 px-1.5 text-[11px]"
            disabled={visualEditActive}
            onClick={() => setDevice('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            {t.viewMobile}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'tablet' ? 'default' : 'outline'}
            className="h-7 gap-1 px-1.5 text-[11px]"
            disabled={visualEditActive}
            onClick={() => setDevice('tablet')}
          >
            <Tablet className="h-3.5 w-3.5" aria-hidden />
            {t.viewTablet}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'laptop' ? 'default' : 'outline'}
            className="h-7 gap-1 px-1.5 text-[11px]"
            disabled={visualEditActive}
            onClick={() => setDevice('laptop')}
          >
            <Laptop className="h-3.5 w-3.5" aria-hidden />
            {t.viewLaptop}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === 'desktop' ? 'default' : 'outline'}
            className="h-7 gap-1 px-1.5 text-[11px]"
            disabled={visualEditActive}
            onClick={() => setDevice('desktop')}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden />
            {t.viewDesktop}
          </Button>
        </div>
      </div>

      {canVisualEdit && onVisualEditSave ? (
        <PartnerWebsiteVisualEditorToolbar
          locale={locale}
          partnerId={partnerId}
          iframeRef={iframeRef}
          projectRef={projectRef}
          active={visualEditActive}
          disabled={quickEditDisabled}
          websiteTitle={websiteTitle}
          onSave={onVisualEditSave}
          onCancel={() => setVisualEditActive(false)}
          onError={(msg) => onVisualEditError?.(msg)}
        />
      ) : null}

      {canVisualEdit && !visualEditActive ? (
        <p className="text-[11px] text-muted-foreground">{t.visualEditSelectHint}</p>
      ) : null}

      <div className={cn('overflow-auto rounded-lg border bg-muted/20 p-1', embedded && 'flex min-h-0 flex-1 flex-col')}>
        <div
          className={cn(
            'mx-auto flex min-h-0 flex-col overflow-hidden rounded-md border bg-white shadow-sm transition-[width] duration-200',
            device === 'desktop' || device === 'laptop' ? 'h-full w-full flex-1' : ''
          )}
          style={frameWidth === 'full' ? undefined : { width: frameWidth, maxWidth: '100%' }}
        >
          <iframe
            key={previewSrc}
            ref={iframeRef}
            title={t.previewTitle}
            src={previewSrc}
            className={cn('block w-full border-0 bg-white', iframeClass)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
        </div>
      </div>

      {embedded ? null : publicUrl ? (
        <p className="text-xs text-muted-foreground">
          {t.previewPublicLink}:{' '}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {publicUrl}
          </a>
        </p>
      ) : siteSlug ? (
        <p className="text-xs text-muted-foreground">{t.publishToView}</p>
      ) : null}
    </div>
  )
}
