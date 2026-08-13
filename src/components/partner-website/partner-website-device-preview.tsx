'use client'

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Laptop, Monitor, Smartphone, Tablet, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { FashionHomeCopyPatch } from '@/lib/partner-website/shop/build-fashion-home-copy'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { applyThemeCssVarsToDocument } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { PartnerWebsiteVisualEditorToolbar } from '@/components/partner-website/partner-website-visual-editor-toolbar'
import {
  PartnerWebsiteThemeColorPicker,
  useDebouncedThemeSave,
} from '@/components/partner-website/partner-website-theme-color-picker'
import {
  freezeDocumentForVisualEditor,
  resolveSavedVisualEditorHtml,
} from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'

export type PartnerWebsitePreviewDevice = 'mobile' | 'tablet' | 'laptop' | 'desktop'

export type PartnerWebsiteDevicePreviewHandle = {
  openVisualEdit: () => void
}

const DEVICE_WIDTH: Record<PartnerWebsitePreviewDevice, number | 'full'> = {
  mobile: 390,
  tablet: 768,
  laptop: 1280,
  desktop: 'full',
}

type PartnerWebsiteDevicePreviewProps = {
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
  onShopHomeSave?: (patch: FashionHomeCopyPatch) => Promise<void>
  onVisualEditError?: (message: string) => void
  onLiveThemeChange?: (theme: PartnerWebsiteTheme) => void
  onThemePersisted?: (theme: PartnerWebsiteTheme) => void
  htmlSource?: string | null
  useVisualHtml?: boolean
}

export const PartnerWebsiteDevicePreview = forwardRef<
  PartnerWebsiteDevicePreviewHandle,
  PartnerWebsiteDevicePreviewProps
>(function PartnerWebsiteDevicePreview(
  {
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
    onLiveThemeChange,
    onThemePersisted,
    onShopHomeSave,
    htmlSource,
    useVisualHtml = false,
  },
  ref
) {
  const t = getPartnerWebsiteCopy(locale)
  const [device, setDevice] = useState<PartnerWebsitePreviewDevice>('desktop')
  const [visualEditActive, setVisualEditActive] = useState(false)
  const [editSrcDoc, setEditSrcDoc] = useState<string | null>(null)
  const [freezeTick, setFreezeTick] = useState(0)
  const [portalReady, setPortalReady] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const projectRef = useRef<PartnerWebsiteProject | null>(null)
  const freezeLockRef = useRef(false)
  projectRef.current = project ?? null

  const { saving: themeSaving, schedule: scheduleThemeSave } = useDebouncedThemeSave(
    partnerId,
    (theme) => onThemePersisted?.(theme),
    () => onVisualEditError?.(t.themeColorSaveError)
  )

  function handleThemeLive(next: PartnerWebsiteTheme) {
    onLiveThemeChange?.(next)
    scheduleThemeSave(next)
  }

  useEffect(() => {
    setPortalReady(true)
  }, [])

  function startVisualEdit() {
    if (!visualEditEnabled || quickEditDisabled || !hasWebsite) return
    if (!onVisualEditSave && !onShopHomeSave) return
    setDevice('desktop')
    const saved = useVisualHtml
      ? resolveSavedVisualEditorHtml({ htmlSource, project })
      : ''
    if (saved.length >= 40) {
      freezeLockRef.current = true
      setEditSrcDoc(saved)
    }
    setVisualEditActive(true)
  }

  useImperativeHandle(ref, () => ({
    openVisualEdit: () => startVisualEdit(),
  }))

  useEffect(() => {
    if (!visualEditActive) {
      freezeLockRef.current = false
      setEditSrcDoc(null)
      return
    }
    if (freezeLockRef.current || editSrcDoc) return

    const saved = useVisualHtml ? resolveSavedVisualEditorHtml({ htmlSource, project }) : ''
    if (saved.length >= 40) {
      freezeLockRef.current = true
      setEditSrcDoc(saved)
      return
    }

    const iframe = iframeRef.current
    if (!iframe) {
      const retry = window.setTimeout(() => setFreezeTick((n) => n + 1), 60)
      return () => window.clearTimeout(retry)
    }

    let cancelled = false

    const freezeFromDoc = (doc: Document | null): boolean => {
      if (cancelled || !doc?.documentElement) return false
      const inner = doc.querySelector(
        'iframe[srcdoc], iframe[title="Landing page"]'
      ) as HTMLIFrameElement | null
      const target =
        inner?.contentDocument?.documentElement ? inner.contentDocument : doc
      const html = freezeDocumentForVisualEditor(target)
      if (html.length < 80) return false
      freezeLockRef.current = true
      setEditSrcDoc(html)
      return true
    }

    const pageLooksReady = (doc: Document | null): boolean => {
      if (!doc?.body) return false
      if (doc.querySelector('.pw-shop, [data-pw-edit], main')) return true
      return (doc.body.innerHTML?.length ?? 0) > 400
    }

    const tryFreeze = () => {
      if (cancelled || freezeLockRef.current) return true
      try {
        const doc = iframe.contentDocument
        if (!doc) return false
        const inner = doc.querySelector(
          'iframe[srcdoc], iframe[title="Landing page"]'
        ) as HTMLIFrameElement | null
        const target =
          inner?.contentDocument?.documentElement ? inner.contentDocument : doc
        if (!pageLooksReady(target) && (doc.body?.innerHTML.length ?? 0) < 800) return false
        return freezeFromDoc(doc)
      } catch {
        return false
      }
    }

    const onLoad = () => {
      window.setTimeout(() => {
        tryFreeze()
      }, 280)
    }
    iframe.addEventListener('load', onLoad)
    const poll = window.setInterval(() => {
      if (tryFreeze()) window.clearInterval(poll)
    }, 220)
    const failSafe = window.setTimeout(() => {
      window.clearInterval(poll)
      if (cancelled || freezeLockRef.current) return
      try {
        freezeFromDoc(iframe.contentDocument)
      } catch {
        /* ignore */
      }
    }, 7000)

    if (iframe.contentDocument?.readyState === 'complete') onLoad()

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onLoad)
      window.clearInterval(poll)
      window.clearTimeout(failSafe)
    }
  }, [visualEditActive, useVisualHtml, htmlSource, project, editSrcDoc, freezeTick])

  useEffect(() => {
    if (!visualEditActive) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisualEditActive(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [visualEditActive])

  const previewSrc = useMemo(() => {
    if (!hasWebsite) return null
    const v = encodeURIComponent(previewVersion || '0')
    if (useVisualHtml && partnerId) {
      return `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`
    }
    if (siteSlug?.trim()) {
      return `/site/${encodeURIComponent(siteSlug.trim())}?v=${v}`
    }
    if (!partnerId) return null
    return `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`
  }, [partnerId, hasWebsite, previewVersion, siteSlug, useVisualHtml])

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
  }, [liveTheme, previewSrc, editSrcDoc])

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

  const iframeClass = visualEditActive
    ? 'h-full min-h-0 flex-1'
    : embedded
      ? 'min-h-[calc(100dvh-11rem)] h-full flex-1'
      : device === 'desktop' || device === 'laptop'
        ? device === 'laptop'
          ? 'min-h-[calc(100dvh-12rem)] h-[min(78vh,900px)]'
          : 'min-h-[calc(100dvh-12rem)] h-[min(80vh,960px)]'
        : 'min-h-[640px] h-[min(78vh,860px)]'

  const canVisualEdit = visualEditEnabled && Boolean(onVisualEditSave || onShopHomeSave)
  const editFrameWidth = visualEditActive ? 'full' : frameWidth

  const previewUi = (
    <div
      className={cn(
        visualEditActive
          ? 'fixed inset-0 z-[90] flex h-[100dvh] w-screen flex-col bg-background overscroll-none'
          : cn('space-y-2', embedded && 'flex min-h-0 flex-1 flex-col')
      )}
    >
      {visualEditActive ? null : (
        <div className={cn('flex shrink-0 flex-wrap items-center gap-2', !embedded && 'justify-between')}>
          {embedded ? null : <p className="text-sm font-medium">{t.previewTitle}</p>}
          <div className={cn('flex flex-wrap items-center gap-1', embedded && 'w-full justify-end')}>
            {canVisualEdit && !embedded ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-7 gap-1 px-2 text-[11px]"
                disabled={quickEditDisabled}
                onClick={() => startVisualEdit()}
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
              onClick={() => setDevice('desktop')}
            >
              <Monitor className="h-3.5 w-3.5" aria-hidden />
              {t.viewDesktop}
            </Button>
          </div>
        </div>
      )}

      {canVisualEdit ? (
        <div className={cn(visualEditActive && 'shrink-0 space-y-1 px-1.5 pt-1')}>
          <PartnerWebsiteVisualEditorToolbar
            locale={locale}
            partnerId={partnerId}
            siteSlug={siteSlug}
            iframeRef={iframeRef}
            projectRef={projectRef}
            active={visualEditActive && Boolean(editSrcDoc)}
            documentKey={editSrcDoc ? 'srcdoc' : 'live'}
            disabled={quickEditDisabled}
            websiteTitle={websiteTitle}
            onSave={onVisualEditSave}
            onSaveShopHome={onShopHomeSave}
            onCancel={() => setVisualEditActive(false)}
            onError={(msg) => onVisualEditError?.(msg)}
            compact={visualEditActive}
          />
          {visualEditActive && !editSrcDoc ? (
            <div className="flex items-center gap-2 px-1 py-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => setVisualEditActive(false)}
              >
                {t.visualEditBack}
              </Button>
              <span className="text-[11px] text-muted-foreground">{t.visualEditPreparing}</span>
            </div>
          ) : null}
          {visualEditActive && liveTheme ? (
            <PartnerWebsiteThemeColorPicker
              t={t}
              theme={liveTheme}
              compact
              layout="bar"
              disabled={quickEditDisabled}
              saving={themeSaving}
              onLiveChange={handleThemeLive}
            />
          ) : null}
        </div>
      ) : null}

      {liveTheme && !visualEditActive ? (
        <PartnerWebsiteThemeColorPicker
          t={t}
          theme={liveTheme}
          compact
          layout="bar"
          disabled={quickEditDisabled}
          saving={themeSaving}
          onLiveChange={handleThemeLive}
        />
      ) : null}

      {canVisualEdit && !visualEditActive && !embedded ? (
        <p className="text-[11px] text-muted-foreground">{t.visualEditSelectHint}</p>
      ) : null}

      <div
        className={cn(
          'overflow-auto rounded-lg border bg-muted/20 p-1',
          (embedded || visualEditActive) && 'flex min-h-0 flex-1 flex-col',
          visualEditActive && 'relative min-h-0 overflow-hidden rounded-none border-0 bg-white p-0'
        )}
      >
        <div
          className={cn(
            'relative mx-auto flex min-h-0 flex-col overflow-hidden rounded-md border bg-white shadow-sm transition-[width] duration-200',
            device === 'desktop' || device === 'laptop' || visualEditActive ? 'h-full w-full flex-1' : '',
            visualEditActive && 'absolute inset-0 h-full w-full rounded-none border-0 shadow-none'
          )}
          style={editFrameWidth === 'full' ? undefined : { width: editFrameWidth, maxWidth: '100%' }}
        >
          <iframe
            key={editSrcDoc ? 've-srcdoc' : previewSrc}
            ref={iframeRef}
            title={t.previewTitle}
            {...(editSrcDoc ? { srcDoc: editSrcDoc } : { src: previewSrc })}
            className={cn('block w-full border-0 bg-white', iframeClass)}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
          {visualEditActive && !editSrcDoc ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-muted-foreground">
              {t.visualEditPreparing}
            </div>
          ) : null}
        </div>
      </div>

      {embedded || visualEditActive ? null : publicUrl ? (
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

  if (visualEditActive && portalReady) {
    return (
      <>
        <div
          className={cn(embedded ? 'min-h-[calc(100dvh-11rem)] flex-1' : 'min-h-[320px]')}
          aria-hidden
        />
        {createPortal(previewUi, document.body)}
      </>
    )
  }

  return previewUi
})
