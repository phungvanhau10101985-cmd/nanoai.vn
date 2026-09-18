'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import { imageUrlToFile } from '@/lib/partner-website/shop/partner-site-image-from-url'
import { looksLikeHttpUrl } from '@/lib/partner-website/shop/partner-site-image-search-errors'
import { storePendingImageAndNavigate } from '@/lib/partner-website/shop/partner-site-pending-image'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

const PANEL_WIDTH_PX = 320
const PANEL_VIEWPORT_GAP = 8

const POPOVER_CSS = `
.pw-img-pop{position:fixed;z-index:100001;box-sizing:border-box;background:#fff;border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.16);padding:16px;color:var(--pw-text,#111);font:13px/1.4 var(--pw-font-ui),system-ui,sans-serif}
.pw-img-pop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:12px}
.pw-img-pop-head strong{font-size:14px;line-height:1.25;color:var(--pw-text,#111)}
.pw-img-pop-head button{border:0;background:transparent;cursor:pointer;font-size:18px;line-height:1;color:var(--pw-muted,#6b7280);padding:0 4px;border-radius:6px}
.pw-img-pop-drop{border:2px dashed color-mix(in srgb,var(--pw-primary,#ea580c) 80%,#fff);border-radius:12px;background:color-mix(in srgb,var(--pw-primary,#ea580c) 8%,#fff);padding:16px;text-align:center}
.pw-img-pop-title{display:block;font-weight:700;color:var(--pw-text,#111)}
.pw-img-pop-hint{display:block;margin-top:6px;font-size:12px;line-height:1.45;color:var(--pw-muted,#6b7280)}
.pw-img-pop-drop input[type=url]{margin-top:12px;width:100%;box-sizing:border-box;border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;padding:8px 10px;font:13px system-ui,sans-serif;color:var(--pw-text,#111);background:#fff}
.pw-img-pop-drop input[type=url]:focus{outline:none;border-color:var(--pw-primary,#ea580c);box-shadow:0 0 0 2px color-mix(in srgb,var(--pw-primary,#ea580c) 30%,#fff)}
.pw-img-pop-busy{display:block;margin-top:8px;font-size:12px;color:var(--pw-primary,#ea580c);font-weight:600}
.pw-img-pop-choose{margin-top:12px;width:100%;border:0;border-radius:8px;padding:10px 12px;background:var(--pw-primary,#ea580c);color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer}
.pw-img-pop-choose:disabled{opacity:.5;cursor:default}
.pw-img-pop-err{margin:8px 0 0;font-size:12px;color:#b91c1c}
.pw-img-pop-trigger{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;padding:0;color:inherit}
`

function clampPanelLeft(triggerRight: number, viewportWidth: number): number {
  const width = Math.min(PANEL_WIDTH_PX, viewportWidth - PANEL_VIEWPORT_GAP * 2)
  let left = triggerRight - width
  if (left < PANEL_VIEWPORT_GAP) left = PANEL_VIEWPORT_GAP
  if (left + width > viewportWidth - PANEL_VIEWPORT_GAP) {
    left = Math.max(PANEL_VIEWPORT_GAP, viewportWidth - width - PANEL_VIEWPORT_GAP)
  }
  return left
}

export function PartnerSiteImageSearchPopover({
  imageSearchPath,
  locale,
  triggerButtonClassName,
  triggerIconClassName = 'block size-6 shrink-0 pointer-events-none',
  wrapperClassName,
  triggerPosition = 'inline-end',
  directFilePicker = false,
  children,
}: {
  imageSearchPath: string
  locale: WebLocale
  triggerButtonClassName?: string
  triggerIconClassName?: string
  wrapperClassName?: string
  triggerPosition?: 'overlay-right' | 'inline-end'
  /** Mobile compose: open the photo picker on the first tap (no extra popover). */
  directFilePicker?: boolean
  children?: React.ReactNode
}) {
  const t = getPartnerSiteShopCopy(locale)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const lastAutoFetchedUrlRef = useRef<string | null>(null)
  const [open, setOpen] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [panelBusy, setPanelBusy] = useState(false)
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const wrapClass =
    wrapperClassName ??
    (triggerPosition === 'inline-end'
      ? 'relative inline-flex h-full shrink-0 items-stretch self-stretch'
      : 'absolute right-11 top-1/2 -translate-y-1/2')

  const updatePanelPos = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(PANEL_WIDTH_PX, vw - PANEL_VIEWPORT_GAP * 2)
    setPanelPos({
      top: r.bottom + 8,
      left: clampPanelLeft(r.right, vw),
      width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPos()
    window.addEventListener('resize', updatePanelPos)
    window.addEventListener('scroll', updatePanelPos, true)
    return () => {
      window.removeEventListener('resize', updatePanelPos)
      window.removeEventListener('scroll', updatePanelPos, true)
    }
  }, [open, updatePanelPos])

  useEffect(() => {
    if (!open) return
    let armed = false
    const armId = window.setTimeout(() => {
      armed = true
    }, 80)
    const onDoc = (e: MouseEvent) => {
      if (!armed) return
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(armId)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setImageUrlInput('')
      lastAutoFetchedUrlRef.current = null
      return
    }
    const timer = window.setTimeout(() => urlInputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const runPendingNavigate = useCallback(
    async (file: File) => {
      setPanelError(null)
      try {
        await storePendingImageAndNavigate(file, router, imageSearchPath)
        setOpen(false)
      } catch {
        setPanelError(t.imageSearchUrlFetchFailed)
      }
    },
    [imageSearchPath, router, t.imageSearchUrlFetchFailed]
  )

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPanelError(null)
    try {
      await storePendingImageAndNavigate(f, router, imageSearchPath)
      setOpen(false)
    } catch {
      window.location.assign(imageSearchPath)
      setOpen(false)
    }
  }

  const fetchUrlAndNavigate = useCallback(
    async (raw: string) => {
      const next = raw.trim()
      if (!next) {
        setPanelError(t.imageSearchUrlInvalid)
        return
      }
      if (!looksLikeHttpUrl(next)) {
        setPanelError(t.imageSearchUrlInvalid)
        return
      }
      setPanelError(null)
      setPanelBusy(true)
      try {
        const file = await imageUrlToFile(next)
        lastAutoFetchedUrlRef.current = next
        await storePendingImageAndNavigate(file, router, imageSearchPath)
        setOpen(false)
      } catch {
        lastAutoFetchedUrlRef.current = null
        setPanelError(t.imageSearchUrlFetchFailed)
      } finally {
        setPanelBusy(false)
      }
    },
    [imageSearchPath, router, t.imageSearchUrlFetchFailed, t.imageSearchUrlInvalid]
  )

  useEffect(() => {
    const raw = imageUrlInput.trim()
    if (!raw) {
      lastAutoFetchedUrlRef.current = null
      return
    }
    if (!looksLikeHttpUrl(raw)) return
    if (raw === lastAutoFetchedUrlRef.current) return
    const id = window.setTimeout(() => {
      const latest = imageUrlInput.trim()
      if (latest !== raw) return
      if (!looksLikeHttpUrl(latest)) return
      if (latest === lastAutoFetchedUrlRef.current) return
      void fetchUrlAndNavigate(latest)
    }, 520)
    return () => window.clearTimeout(id)
  }, [imageUrlInput, fetchUrlAndNavigate])

  const pasteImageFromClipboard = (e: { clipboardData: DataTransfer | null; preventDefault: () => void }) => {
    const cd = e.clipboardData
    if (!cd) return false
    for (const it of Array.from(cd.items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile()
        if (f) {
          e.preventDefault()
          void runPendingNavigate(f)
          return true
        }
      }
    }
    for (const f of Array.from(cd.files)) {
      if (f.type.startsWith('image/')) {
        e.preventDefault()
        void runPendingNavigate(f)
        return true
      }
    }
    return false
  }

  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return
      const target = e.target as Node | null
      if (target && panelRef.current?.contains(target)) return
      if (pasteImageFromClipboard(e)) return
      const ae = document.activeElement as HTMLElement | null
      const isOtherFormField =
        ae &&
        (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable) &&
        ae !== urlInputRef.current
      if (isOtherFormField) return
      const text = e.clipboardData?.getData('text/plain')?.trim() ?? ''
      if (looksLikeHttpUrl(text)) {
        e.preventDefault()
        setImageUrlInput(text)
        void fetchUrlAndNavigate(text)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open, fetchUrlAndNavigate, runPendingNavigate])

  const onDropZonePaste = (e: React.ClipboardEvent) => {
    if (e.target === urlInputRef.current) return
    if (pasteImageFromClipboard(e)) return
    const text = e.clipboardData?.getData('text/plain')?.trim() ?? ''
    if (looksLikeHttpUrl(text)) {
      e.preventDefault()
      setImageUrlInput(text)
      void fetchUrlAndNavigate(text)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f?.type.startsWith('image/')) void runPendingNavigate(f)
  }

  const panel =
    open &&
    panelPos &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.imageSearchTitle}
        className="pw-img-pop"
        style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
      >
        <style>{POPOVER_CSS}</style>
        <div className="pw-img-pop-head">
          <strong>{t.imageSearchTitle}</strong>
          <button type="button" aria-label={t.imageSearchClose} onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <div
          className="pw-img-pop-drop"
          onPaste={onDropZonePaste}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          aria-label={t.imageSearchPaste}
        >
          <span className="pw-img-pop-title">{t.imageSearchPaste}</span>
          <span className="pw-img-pop-hint">{t.imageSearchPasteHint}</span>
          <input
            ref={urlInputRef}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={imageUrlInput}
            disabled={panelBusy}
            onChange={(e) => {
              setImageUrlInput(e.target.value)
              setPanelError(null)
            }}
            onPaste={(e) => {
              pasteImageFromClipboard(e)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                lastAutoFetchedUrlRef.current = null
                void fetchUrlAndNavigate(imageUrlInput)
              }
            }}
            aria-label={t.imageSearchUrlPlaceholder}
          />
          {panelBusy ? <span className="pw-img-pop-busy">{t.imageSearchBusy}</span> : null}
          <button
            type="button"
            className="pw-img-pop-choose"
            disabled={panelBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {t.imageSearchChoose}
          </button>
        </div>
        {panelError ? (
          <p className="pw-img-pop-err" role="alert">
            {panelError}
          </p>
        ) : null}
      </div>,
      document.body
    )

  return (
    <>
      <style>{POPOVER_CSS}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        hidden
        aria-hidden
        onChange={(e) => void onFileChange(e)}
      />
      <div ref={anchorRef} className={wrapClass}>
        <button
          type="button"
          data-pw-image-search="1"
          data-pw-image-pop-react="1"
          className={triggerButtonClassName || 'pw-img-pop-trigger'}
          aria-label={t.searchByImage}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={t.searchByImage}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setPanelError(null)
            const mobile =
              typeof window !== 'undefined' &&
              (window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches)
            if (directFilePicker || mobile) {
              fileInputRef.current?.click()
              return
            }
            setOpen((v) => !v)
          }}
        >
          {children || (
            <svg className={triggerIconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      {panel}
    </>
  )
}
