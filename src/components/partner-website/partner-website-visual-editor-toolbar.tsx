'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, ClipboardList, Clock, Copy, Eye, EyeOff, Heart, ImagePlus, LayoutTemplate, Loader2, LogIn, MapPin, Phone, Plus, ShoppingBag, Sparkles, Trash2, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { uploadPartnerImageFile } from '@/components/partner-website/partner-website-asset-panel'
import {
  buildVisualEditorScript,
  NANOAI_VE_MESSAGE,
} from '@/lib/partner-website/visual-editor/build-visual-editor-script'
import {
  mergeVisualHtmlIntoProject,
  serializeVisualEditorHtml,
} from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import { inferVisualEditImageKind } from '@/lib/partner-website/visual-editor/visual-editor-css-url'
import {
  buildVisualEditorChromeWidgetHtml,
  chromeWidgetHost,
  type VisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  extractFashionHomeCopyFromDocument,
  type FashionHomeCopyPatch,
} from '@/lib/partner-website/shop/build-fashion-home-copy'

export type VisualEditorSelection = {
  isText: boolean
  isImage: boolean
  isBlock: boolean
  isButton: boolean
  isChrome: boolean
  isBgImage: boolean
  isLogo: boolean
  hasParentBlock: boolean
  canOverlay: boolean
  overlay: number
  paddingY: number
  paddingX: number
  blockLabel: string
  textColor: string
  fontSize: number
  fontWeight: string
  textAlign: string
  bgColor: string
  src: string
  href: string
  imageWidth: number
  width: number
  height: number
}

type HiddenBlock = { id: string; label: string }

type Props = {
  locale: WebLocale
  partnerId: string
  siteSlug?: string
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  projectRef: React.RefObject<PartnerWebsiteProject | null>
  active: boolean
  disabled?: boolean
  websiteTitle?: string
  compact?: boolean
  onSave?: (project: PartnerWebsiteProject) => Promise<void>
  onSaveShopHome?: (patch: FashionHomeCopyPatch) => Promise<void>
  onCancel: () => void
  onError: (message: string) => void
  /** Bump when iframe document is replaced (src → srcdoc freeze). */
  documentKey?: string
}

function postToIframe(iframe: HTMLIFrameElement | null, type: string, payload?: Record<string, unknown>) {
  iframe?.contentWindow?.postMessage({ source: NANOAI_VE_MESSAGE, type, ...payload }, '*')
}

function cleanSerializedHtml(raw: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  return serializeVisualEditorHtml(doc)
}

export function PartnerWebsiteVisualEditorToolbar({
  locale,
  partnerId,
  siteSlug,
  iframeRef,
  projectRef,
  active,
  disabled,
  websiteTitle,
  compact = false,
  onSave,
  onSaveShopHome,
  onCancel,
  onError,
  documentKey,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [selection, setSelection] = useState<VisualEditorSelection | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [useCurrentRef, setUseCurrentRef] = useState(true)
  const [refUrl, setRefUrl] = useState('')
  const [hrefDraft, setHrefDraft] = useState('')
  const [hiddenBlocks, setHiddenBlocks] = useState<HiddenBlock[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)
  const scriptInjectedRef = useRef(false)

  const injectScript = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc || scriptInjectedRef.current) return
    if (doc.getElementById('nanoai-visual-editor-script')) {
      scriptInjectedRef.current = true
      return
    }
    const script = doc.createElement('script')
    script.id = 'nanoai-visual-editor-script'
    script.textContent = buildVisualEditorScript(locale)
    doc.body.appendChild(script)
    scriptInjectedRef.current = true
  }, [iframeRef, locale])

  useEffect(() => {
    scriptInjectedRef.current = false
  }, [iframeRef.current?.src, active, documentKey])

  useEffect(() => {
    if (!active) return
    const iframe = iframeRef.current
    if (!iframe) return

    const onLoad = () => {
      scriptInjectedRef.current = false
      injectScript()
      postToIframe(iframe, 'activate')
    }

    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') onLoad()

    return () => {
      iframe.removeEventListener('load', onLoad)
      postToIframe(iframe, 'deactivate')
    }
  }, [active, documentKey, iframeRef, injectScript])

  const handleSaveHtml = useCallback(
    async (rawHtml: string) => {
      setSaving(true)
      try {
        const iframe = iframeRef.current
        const doc = iframe?.contentDocument
        if (onSave) {
          const html = doc ? serializeVisualEditorHtml(doc) : cleanSerializedHtml(rawHtml)
          const projectRaw = projectRef.current?.files?.length
            ? projectRef.current
            : { entryPath: 'index.html', files: [{ path: 'index.html', kind: 'html' as const, content: html }] }
          const next = mergeVisualHtmlIntoProject(projectRaw, html) as PartnerWebsiteProject
          await onSave(next)
          setDirty(false)
          return
        }
        if (onSaveShopHome) {
          if (!doc) {
            onError(t.visualEditSaveFailed)
            return
          }
          const patch = extractFashionHomeCopyFromDocument(doc)
          if (Object.values(patch).some((v) => v != null && !(Array.isArray(v) && v.length === 0))) {
            await onSaveShopHome(patch)
          }
          setDirty(false)
          return
        }
        onError(t.visualEditSaveFailed)
      } catch (e) {
        onError(e instanceof Error ? e.message : t.visualEditSaveFailed)
      } finally {
        setSaving(false)
      }
    },
    [iframeRef, onError, onSave, onSaveShopHome, projectRef, t.visualEditSaveFailed]
  )

  useEffect(() => {
    if (!active) {
      setSelection(null)
      setDirty(false)
      setAiPrompt('')
      setRefUrl('')
      setHrefDraft('')
      setHiddenBlocks([])
      return
    }

    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string
        type?: string
        isText?: boolean
        isImage?: boolean
        isBlock?: boolean
        isButton?: boolean
        isBgImage?: boolean
        isLogo?: boolean
        hasParentBlock?: boolean
        canOverlay?: boolean
        overlay?: number
        paddingY?: number
        paddingX?: number
        blockLabel?: string
        textColor?: string
        fontSize?: number
        fontWeight?: string
        textAlign?: string
        bgColor?: string
        src?: string
        href?: string
        imageWidth?: number
        html?: string
        rect?: { width?: number; height?: number }
        hidden?: HiddenBlock[]
      }
      if (data?.source !== NANOAI_VE_MESSAGE) return

      if (data.type === 'select') {
        const src = String(data.src ?? '')
        const href = String(data.href ?? '')
        setSelection({
          isText: Boolean(data.isText),
          isImage: Boolean(data.isImage),
          isBlock: Boolean(data.isBlock),
          isButton: Boolean(data.isButton),
          isChrome: Boolean(data.isChrome),
          isBgImage: Boolean(data.isBgImage),
          isLogo: Boolean(data.isLogo),
          hasParentBlock: Boolean(data.hasParentBlock),
          canOverlay: Boolean(data.canOverlay),
          overlay: Number(data.overlay) || 0,
          paddingY: Number(data.paddingY) || 0,
          paddingX: Number(data.paddingX) || 0,
          blockLabel: String(data.blockLabel ?? ''),
          textColor: String(data.textColor ?? ''),
          fontSize: Number(data.fontSize) || 16,
          fontWeight: String(data.fontWeight ?? '400'),
          textAlign: String(data.textAlign ?? 'left'),
          bgColor: String(data.bgColor ?? ''),
          src,
          href,
          imageWidth: Number(data.imageWidth) || 100,
          width: Number(data.rect?.width) || 0,
          height: Number(data.rect?.height) || 0,
        })
        setHrefDraft(href)
        setUseCurrentRef(Boolean(src))
      }
      if (data.type === 'deselect') {
        setSelection(null)
        setHrefDraft('')
      }
      if (data.type === 'ready' || data.type === 'loaded') {
        postToIframe(iframeRef.current, 'listHidden')
      }
      if (data.type === 'dirty') setDirty(true)
      if (data.type === 'hidden' && Array.isArray(data.hidden)) {
        setHiddenBlocks(
          data.hidden.map((row) => ({ id: String(row.id ?? ''), label: String(row.label ?? '') })).filter((row) => row.id)
        )
      }
      if (data.type === 'html' && data.html) {
        void handleSaveHtml(data.html)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active, handleSaveHtml])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if (!selection) return
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return
      e.preventDefault()
      e.stopPropagation()
      postToIframe(iframeRef.current, 'nudge', { dx, dy })
      setDirty(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, iframeRef, selection])

  function requestSave() {
    postToIframe(iframeRef.current, 'serialize')
  }

  async function handleUploadReplace(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      postToIframe(iframeRef.current, 'setImageSrc', { url })
      setDirty(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleUploadReference(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      setRefUrl(url)
      setUseCurrentRef(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleGenerateAi() {
    const prompt = aiPrompt.trim()
    if (prompt.length < 4) {
      onError(t.visualEditAiPromptRequired)
      return
    }
    if (!partnerId || !selection) return
    const inferred = inferVisualEditImageKind(selection)
    const referenceImageUrl = refUrl.trim() || (useCurrentRef ? selection.src.trim() : '')
    setAiBusy(true)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/visual-edit-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            prompt,
            referenceImageUrl: referenceImageUrl || null,
            title: websiteTitle || 'Partner website',
            kind: inferred.kind,
            aspectRatio: inferred.aspectRatio,
          }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
      if (!res.ok || !json.publicUrl) {
        onError(json.error || t.visualEditAiFailed)
        return
      }
      postToIframe(iframeRef.current, 'setImageSrc', { url: json.publicUrl })
      setDirty(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.visualEditAiFailed)
    } finally {
      setAiBusy(false)
    }
  }

  function commitHref(next: string) {
    setHrefDraft(next)
    postToIframe(iframeRef.current, 'setHref', { href: next })
    setDirty(true)
  }

  function insertChromeWidget(kind: VisualEditorChromeWidgetKind, menu?: HTMLDetailsElement | null) {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    const html = buildVisualEditorChromeWidgetHtml({ kind, siteSlug: slug, locale })
    if (!html) return
    postToIframe(iframeRef.current, 'insertChromeBtn', {
      kind,
      html,
      host: chromeWidgetHost(kind),
    })
    setDirty(true)
    menu?.removeAttribute('open')
  }

  if (!active) return null

  const isBold = selection?.fontWeight === '700' || selection?.fontWeight === 'bold'
  const showImageTools = Boolean(selection?.isImage || selection?.isBgImage)
  const showHref = Boolean(selection?.isButton || (selection && selection.href && selection.isText && !selection.isImage))
  const showBlockTools = Boolean(selection?.isBlock || selection?.isBgImage)
  const busy = disabled || saving || uploadBusy || aiBusy

  const btn = compact ? 'h-6 px-1.5 text-[10px]' : 'h-7 px-2 text-xs'
  const slider = compact ? 'h-5 w-16 accent-primary' : 'h-7 w-24 accent-primary'

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-lg border border-primary/30 bg-primary/5',
          compact ? 'gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
        )}
      >
        <div className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2')}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(btn, 'gap-1')}
            disabled={saving}
            onClick={onCancel}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t.visualEditBack}
          </Button>
          <details className="relative">
            <summary
              className={cn(
                'inline-flex list-none cursor-pointer items-center gap-1 rounded-md border bg-background font-medium [&::-webkit-details-marker]:hidden',
                btn,
                busy && 'pointer-events-none opacity-50'
              )}
              title={t.visualEditAddWidget}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t.visualEditAddWidget}
            </summary>
            <div className="absolute left-0 top-full z-30 mt-1 max-h-[min(70vh,24rem)] min-w-[13rem] overflow-y-auto rounded-md border bg-background p-1 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.visualEditAddGroupIcons}
              </p>
              {(
                [
                  ['wishlist', Heart, t.visualEditAddWishlist],
                  ['recently-viewed', Clock, t.visualEditAddRecentlyViewed],
                  ['cart', ShoppingBag, t.visualEditAddCart],
                  ['orders', ClipboardList, t.visualEditAddOrders],
                  ['account', User, t.visualEditAddAccount],
                  ['addresses', MapPin, t.visualEditAddAddresses],
                ] as const
              ).map(([kind, Icon, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                  disabled={busy}
                  onClick={(e) => insertChromeWidget(kind, e.currentTarget.closest('details'))}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </button>
              ))}
              <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.visualEditAddGroupLinks}
              </p>
              {(
                [
                  ['contact', Phone, t.visualEditAddContact],
                  ['favorites-link', Heart, t.visualEditAddFavoritesLink],
                  ['login', LogIn, t.visualEditAddLogin],
                  ['orders-link', ClipboardList, t.visualEditAddOrdersLink],
                ] as const
              ).map(([kind, Icon, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                  disabled={busy}
                  onClick={(e) => insertChromeWidget(kind, e.currentTarget.closest('details'))}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </details>
          {selection ? (
            <span className="max-w-[14rem] text-[10px] leading-tight text-muted-foreground">
              {t.visualEditNudgeHint}
            </span>
          ) : null}
          <p className={cn('font-medium text-primary', compact ? 'text-[10px]' : 'text-xs')}>
            {t.visualEditModeActive}
          </p>
          {selection?.isText ? (
            <>
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditTextColor}</span>
                <input
                  type="color"
                  key={`tc-${selection.textColor}`}
                  defaultValue={rgbToHex(selection.textColor) || '#111827'}
                  className={cn('cursor-pointer rounded border p-0.5', compact ? 'h-6 w-7' : 'h-7 w-9')}
                  disabled={busy}
                  onChange={(e) => postToIframe(iframeRef.current, 'setColor', { color: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditFontSize}</span>
                <input
                  type="range"
                  min={10}
                  max={72}
                  value={selection.fontSize}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setFontSize', { size: Number(e.target.value) })
                  }
                />
                <span className="w-5 tabular-nums text-muted-foreground">{selection.fontSize}</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant={isBold ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setFontWeight', { bold: !isBold })}
              >
                <Bold className="h-3.5 w-3.5" />
                {compact ? null : <span className="ml-1">{t.visualEditBold}</span>}
              </Button>
              <div className="flex items-center gap-0.5">
                {(
                  [
                    ['left', AlignLeft, t.visualEditAlignLeft],
                    ['center', AlignCenter, t.visualEditAlignCenter],
                    ['right', AlignRight, t.visualEditAlignRight],
                  ] as const
                ).map(([align, Icon, label]) => (
                  <Button
                    key={align}
                    type="button"
                    size="sm"
                    variant={selection.textAlign === align ? 'default' : 'outline'}
                    className={cn(btn, 'px-1.5')}
                    disabled={busy}
                    title={label}
                    onClick={() => postToIframe(iframeRef.current, 'setTextAlign', { align })}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          {selection?.isBlock ? (
            <label className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditBgColor}</span>
              <input
                type="color"
                key={`bg-${selection.bgColor}`}
                defaultValue={rgbToHex(selection.bgColor) || '#ffffff'}
                className={cn('cursor-pointer rounded border p-0.5', compact ? 'h-6 w-7' : 'h-7 w-9')}
                disabled={busy}
                onChange={(e) => postToIframe(iframeRef.current, 'setBgColor', { color: e.target.value })}
              />
            </label>
          ) : null}
          {selection?.isImage ? (
            <>
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">{t.visualEditImageWidth}</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={selection.imageWidth}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setImageWidth', { width: Number(e.target.value) })
                  }
                />
                <span className="w-7 tabular-nums text-muted-foreground">{selection.imageWidth}%</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={btn}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'resetImageTransform')}
              >
                {t.visualEditResetImagePos}
              </Button>
            </>
          ) : null}
          {showBlockTools && selection ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                title={t.visualEditBlockHide}
                onClick={() => postToIframe(iframeRef.current, 'hideBlock')}
              >
                <EyeOff className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockHide}</span>}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                title={t.visualEditBlockDuplicate}
                onClick={() => postToIframe(iframeRef.current, 'duplicateBlock')}
              >
                <Copy className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockDuplicate}</span>}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(btn, 'text-destructive')}
                disabled={busy}
                title={t.visualEditBlockDelete}
                onClick={() => postToIframe(iframeRef.current, 'deleteBlock')}
              >
                <Trash2 className="h-3 w-3" />
                {compact ? null : <span className="ml-1">{t.visualEditBlockDelete}</span>}
              </Button>
              <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockPaddingY}>
                <span className="text-muted-foreground">{compact ? 'Y' : t.visualEditBlockPaddingY}</span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={selection.paddingY}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setPadding', { y: Number(e.target.value) })
                  }
                />
                <span className="w-6 tabular-nums text-muted-foreground">{selection.paddingY}</span>
              </label>
              <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockPaddingX}>
                <span className="text-muted-foreground">{compact ? 'X' : t.visualEditBlockPaddingX}</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={selection.paddingX}
                  className={slider}
                  disabled={busy}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setPadding', { x: Number(e.target.value) })
                  }
                />
                <span className="w-6 tabular-nums text-muted-foreground">{selection.paddingX}</span>
              </label>
              {selection.canOverlay ? (
                <label className="flex items-center gap-1 text-[10px]" title={t.visualEditBlockOverlay}>
                  <span className="text-muted-foreground">{compact ? '%' : t.visualEditBlockOverlay}</span>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={selection.overlay}
                    className={slider}
                    disabled={busy}
                    onChange={(e) =>
                      postToIframe(iframeRef.current, 'setOverlay', { value: Number(e.target.value) })
                    }
                  />
                  <span className="w-7 tabular-nums text-muted-foreground">{selection.overlay}%</span>
                </label>
              ) : null}
            </>
          ) : null}
          {selection && !selection.isBlock ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'text-destructive')}
              disabled={busy}
              title={t.visualEditChromeDelete}
              onClick={() => {
                postToIframe(iframeRef.current, 'deleteUnit')
                setDirty(true)
              }}
            >
              <Plus className="h-3 w-3 rotate-45" aria-hidden />
              {compact ? null : <span className="ml-1">{t.visualEditChromeDelete}</span>}
            </Button>
          ) : null}
          {selection?.hasParentBlock && !selection.isBlock ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={btn}
              disabled={busy}
              onClick={() => postToIframe(iframeRef.current, 'selectParentBlock')}
            >
              <LayoutTemplate className="mr-1 h-3 w-3" />
              {t.visualEditSelectBlock}
              {selection.blockLabel && !compact ? ` · ${selection.blockLabel}` : ''}
            </Button>
          ) : null}
          {!selection && !compact ? (
            <span className="text-[11px] text-muted-foreground">{t.visualEditSelectHint}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={btn}
              disabled={saving}
              onClick={onCancel}
            >
              <X className="mr-1 h-3 w-3" />
              {t.visualEditCancel}
            </Button>
            <Button
              type="button"
              size="sm"
              className={btn}
              disabled={busy || !dirty}
              onClick={requestSave}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t.visualEditSave}
            </Button>
          </div>
        </div>

        {hiddenBlocks.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">{t.visualEditHiddenBlocks}:</span>
            {hiddenBlocks.map((row) => (
              <Button
                key={row.id}
                type="button"
                size="sm"
                variant="secondary"
                className={btn}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'showHidden', { id: row.id })}
              >
                <Eye className="mr-1 h-3 w-3" />
                {t.visualEditBlockShow}
                {row.label ? ` · ${row.label}` : ''}
              </Button>
            ))}
          </div>
        ) : null}

        {showHref && selection ? (
          <label className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px]">
            <span className="shrink-0 text-muted-foreground">{t.visualEditButtonHref}</span>
            <input
              type="text"
              value={hrefDraft}
              placeholder={t.visualEditButtonHrefPlaceholder}
              className={cn(
                'min-w-[12rem] flex-1 rounded-md border bg-background px-2',
                compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
              )}
              disabled={busy}
              onChange={(e) => setHrefDraft(e.target.value)}
              onBlur={(e) => commitHref(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitHref(hrefDraft)
                }
              }}
            />
          </label>
        ) : null}

        {showImageTools && selection ? (
          <div
            className={cn(
              'flex flex-col rounded-md border bg-background/80',
              compact ? 'gap-1 p-1.5' : 'gap-2 p-2'
            )}
          >
            {compact ? null : (
              <>
                <p className="text-xs font-medium">{t.visualEditAiImageTitle}</p>
                <p className="text-[11px] text-muted-foreground">{t.visualEditAiImageHint}</p>
              </>
            )}
            <label className="sr-only" htmlFor="nanoai-ve-ai-prompt">
              {t.visualEditAiPromptLabel}
            </label>
            <textarea
              id="nanoai-ve-ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t.visualEditAiImagePlaceholder}
              rows={compact ? 1 : 2}
              disabled={busy}
              className={cn(
                'w-full resize-y rounded-md border bg-background px-2 py-1',
                compact ? 'text-[10px]' : 'text-xs'
              )}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {selection.src ? (
                <img
                  src={refUrl || selection.src}
                  alt=""
                  className={cn('rounded border object-cover', compact ? 'h-7 w-10' : 'h-10 w-16')}
                />
              ) : null}
              <label className="flex items-center gap-1 text-[10px]">
                <input
                  type="checkbox"
                  checked={useCurrentRef && !refUrl}
                  disabled={busy || !selection.src}
                  onChange={(e) => {
                    setUseCurrentRef(e.target.checked)
                    if (e.target.checked) setRefUrl('')
                  }}
                />
                {t.visualEditUseCurrentAsRef}
              </label>
              <input
                ref={refFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleUploadReference(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                onClick={() => refFileRef.current?.click()}
              >
                {t.visualEditUploadReference}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleUploadReplace(e.target.files)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={btn}
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {uploadBusy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ImagePlus className="mr-1 h-3 w-3" />
                )}
                {t.visualEditReplaceImage}
              </Button>
              <Button
                type="button"
                size="sm"
                className={btn}
                disabled={busy}
                onClick={() => void handleGenerateAi()}
              >
                {aiBusy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                {t.visualEditCreateWithAi}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
  return `#${hex(m[1]!)}${hex(m[2]!)}${hex(m[3]!)}`
}
