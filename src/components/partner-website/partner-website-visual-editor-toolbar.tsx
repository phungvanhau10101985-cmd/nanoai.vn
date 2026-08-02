'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Bold, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export type VisualEditorSelection = {
  isText: boolean
  isImage: boolean
  isBlock: boolean
  textColor: string
  fontSize: number
  fontWeight: string
  textAlign: string
  bgColor: string
  src: string
  imageWidth: number
}

type Props = {
  locale: WebLocale
  partnerId: string
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  projectRef: React.RefObject<PartnerWebsiteProject | null>
  active: boolean
  disabled?: boolean
  websiteTitle?: string
  onSave: (project: PartnerWebsiteProject) => Promise<void>
  onCancel: () => void
  onError: (message: string) => void
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
  iframeRef,
  projectRef,
  active,
  disabled,
  onSave,
  onCancel,
  onError,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [selection, setSelection] = useState<VisualEditorSelection | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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
  }, [iframeRef.current?.src])

  useEffect(() => {
    if (!active) return
    const iframe = iframeRef.current
    if (!iframe) return

    const onLoad = () => {
      injectScript()
      postToIframe(iframe, 'activate')
    }

    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') onLoad()

    return () => {
      iframe.removeEventListener('load', onLoad)
      postToIframe(iframe, 'deactivate')
    }
  }, [active, iframeRef, injectScript])

  const handleSaveHtml = useCallback(
    async (rawHtml: string) => {
      setSaving(true)
      try {
        const iframe = iframeRef.current
        const doc = iframe?.contentDocument
        const html = doc ? serializeVisualEditorHtml(doc) : cleanSerializedHtml(rawHtml)
        const projectRaw = projectRef.current
        if (!projectRaw?.files?.length) {
          onError(t.visualEditSaveFailed)
          return
        }
        const next = mergeVisualHtmlIntoProject(projectRaw, html) as PartnerWebsiteProject
        await onSave(next)
        setDirty(false)
      } catch (e) {
        onError(e instanceof Error ? e.message : t.visualEditSaveFailed)
      } finally {
        setSaving(false)
      }
    },
    [iframeRef, onError, onSave, projectRef, t.visualEditSaveFailed]
  )

  useEffect(() => {
    if (!active) {
      setSelection(null)
      setDirty(false)
      return
    }

    function onMessage(ev: MessageEvent) {
      const data = ev.data as {
        source?: string
        type?: string
        isText?: boolean
        isImage?: boolean
        isBlock?: boolean
        textColor?: string
        fontSize?: number
        fontWeight?: string
        textAlign?: string
        bgColor?: string
        src?: string
        imageWidth?: number
        html?: string
      }
      if (data?.source !== NANOAI_VE_MESSAGE) return

      if (data.type === 'select') {
        setSelection({
          isText: Boolean(data.isText),
          isImage: Boolean(data.isImage),
          isBlock: Boolean(data.isBlock),
          textColor: String(data.textColor ?? ''),
          fontSize: Number(data.fontSize) || 16,
          fontWeight: String(data.fontWeight ?? '400'),
          textAlign: String(data.textAlign ?? 'left'),
          bgColor: String(data.bgColor ?? ''),
          src: String(data.src ?? ''),
          imageWidth: Number(data.imageWidth) || 100,
        })
      }
      if (data.type === 'deselect') setSelection(null)
      if (data.type === 'dirty') setDirty(true)
      if (data.type === 'html' && data.html) {
        void handleSaveHtml(data.html)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active, handleSaveHtml])

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

  if (!active) return null

  const isBold = selection?.fontWeight === '700' || selection?.fontWeight === 'bold'

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-primary">{t.visualEditModeActive}</p>
          {selection?.isText ? (
            <>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t.visualEditTextColor}</span>
                <input
                  type="color"
                  key={`tc-${selection.textColor}`}
                  defaultValue={rgbToHex(selection.textColor) || '#111827'}
                  className="h-7 w-9 cursor-pointer rounded border p-0.5"
                  disabled={disabled || saving}
                  onChange={(e) => postToIframe(iframeRef.current, 'setColor', { color: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t.visualEditFontSize}</span>
                <input
                  type="range"
                  min={10}
                  max={72}
                  value={selection.fontSize}
                  className="h-7 w-24 accent-primary"
                  disabled={disabled || saving}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setFontSize', { size: Number(e.target.value) })
                  }
                />
                <span className="w-6 tabular-nums text-muted-foreground">{selection.fontSize}</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant={isBold ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                disabled={disabled || saving}
                onClick={() => postToIframe(iframeRef.current, 'setFontWeight', { bold: !isBold })}
              >
                <Bold className="h-3.5 w-3.5" />
                <span className="ml-1">{t.visualEditBold}</span>
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
                    className="h-7 px-2 text-xs"
                    disabled={disabled || saving}
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
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{t.visualEditBgColor}</span>
              <input
                type="color"
                key={`bg-${selection.bgColor}`}
                defaultValue={rgbToHex(selection.bgColor) || '#ffffff'}
                className="h-7 w-9 cursor-pointer rounded border p-0.5"
                disabled={disabled || saving}
                onChange={(e) => postToIframe(iframeRef.current, 'setBgColor', { color: e.target.value })}
              />
            </label>
          ) : null}
          {selection?.isImage ? (
            <>
              <label className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t.visualEditImageWidth}</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={selection.imageWidth}
                  className="h-7 w-24 accent-primary"
                  disabled={disabled || saving}
                  onChange={(e) =>
                    postToIframe(iframeRef.current, 'setImageWidth', { width: Number(e.target.value) })
                  }
                />
                <span className="w-8 tabular-nums text-muted-foreground">{selection.imageWidth}%</span>
              </label>
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
                className="h-7 text-xs"
                disabled={disabled || saving || uploadBusy}
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
                variant="ghost"
                className="h-7 text-xs"
                disabled={disabled || saving}
                onClick={() => postToIframe(iframeRef.current, 'resetImageTransform')}
              >
                {t.visualEditResetImagePos}
              </Button>
              <span className="text-[11px] text-muted-foreground">{t.visualEditDragImage}</span>
            </>
          ) : null}
          {!selection ? (
            <span className="text-[11px] text-muted-foreground">{t.visualEditSelectHint}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={saving}
              onClick={onCancel}
            >
              <X className="mr-1 h-3 w-3" />
              {t.visualEditCancel}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled || saving || !dirty}
              onClick={requestSave}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {t.visualEditSave}
            </Button>
          </div>
        </div>
        {!selection ? (
          <p className="text-[11px] text-muted-foreground">{t.visualEditSectionHint}</p>
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
