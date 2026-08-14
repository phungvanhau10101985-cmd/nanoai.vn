'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bell, Bold, CircleHelp, ClipboardList, Clock, Copy, CreditCard, Download, ExternalLink, Eye, EyeOff, FileText, Heart, Home, ImagePlus, Images, Info, LayoutTemplate, Loader2, Lock, LogIn, MapPin, MessageCircle, MousePointerClick, Newspaper, Package, Pencil, Phone, Plus, Redo2, RotateCcw, Ruler, Shield, ShoppingBag, Sparkles, Store, Tag, Trash2, Truck, Type, Undo2, User, Wallet, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  mergeLogoSlotPrompt,
  type LogoSlotKind,
  type LogoSlotPromptInput,
} from '@/lib/partner-website/visual-editor/build-logo-slot-prompt'
import {
  collectHttpImageUrls,
  dataUrlToPngFile,
  makeThemeSwatchDataUrl,
  requestLogoContextFromIframe,
} from '@/lib/partner-website/visual-editor/logo-generation-context'
import { persistVisualEditorAdminLogo } from '@/lib/partner-website/visual-editor/persist-visual-editor-admin-logo'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { resolveShopThemeColors } from '@/lib/partner-website/template/partner-website-theme-tokens'
import {
  buildVisualEditorChromeWidgetHtml,
  chromeWidgetHost,
  chromeWidgetLabel,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS,
  type VisualEditorChromeWidgetKind,
  type VisualEditorChromeWidgetPickerGroupId,
  type VisualEditorChromeWidgetPlace,
  type VisualEditorChromeWidgetStyle,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
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
  chromeStyle: VisualEditorChromeWidgetStyle | ''
  btnStyle: 'hero' | 'primary' | 'outline' | ''
  btnColor: string
  btnBorder: string
  text: string
  isBgImage: boolean
  isLogo: boolean
  logoFace: 'text' | 'image' | 'empty'
  logoSlot: LogoSlotKind
  logoBg: string
  logoBgImage: string
  themePrimary: string
  themeAccent: string
  themeBuy: string
  logoSlotCount: number
  logoFilledCount: number
  logoCropX: number
  logoCropY: number
  hasImageLayer: boolean
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

function parseLogoSlot(raw: unknown): LogoSlotKind {
  return raw === 'footer' || raw === 'header' ? raw : 'other'
}

function parseLogoFace(raw: unknown): VisualEditorSelection['logoFace'] {
  return raw === 'text' || raw === 'image' || raw === 'empty' ? raw : 'empty'
}

function selectionFromMessage(data: {
  isText?: boolean
  isImage?: boolean
  isBlock?: boolean
  isButton?: boolean
  isChrome?: boolean
  chromeStyle?: string
  btnStyle?: string
  btnColor?: string
  btnBorder?: string
  text?: string
  isBgImage?: boolean
  isLogo?: boolean
  logoFace?: string
  logoSlot?: string
  logoBg?: string
  logoBgImage?: string
  themePrimary?: string
  themeAccent?: string
  themeBuy?: string
  logoSlotCount?: number
  logoFilledCount?: number
  logoCropX?: number
  logoCropY?: number
  hasImageLayer?: boolean
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
  rect?: { width?: number; height?: number }
}): VisualEditorSelection {
  return {
    isText: Boolean(data.isText),
    isImage: Boolean(data.isImage),
    isBlock: Boolean(data.isBlock),
    isButton: Boolean(data.isButton),
    isChrome: Boolean(data.isChrome),
    chromeStyle:
      data.chromeStyle === 'icon' || data.chromeStyle === 'icon-label' || data.chromeStyle === 'text'
        ? data.chromeStyle
        : '',
    btnStyle:
      data.btnStyle === 'hero' || data.btnStyle === 'primary' || data.btnStyle === 'outline'
        ? data.btnStyle
        : '',
    btnColor: String(data.btnColor ?? ''),
    btnBorder: String(data.btnBorder ?? ''),
    text: String(data.text ?? ''),
    isBgImage: Boolean(data.isBgImage),
    isLogo: Boolean(data.isLogo),
    logoFace: parseLogoFace(data.logoFace),
    logoSlot: parseLogoSlot(data.logoSlot),
    logoBg: String(data.logoBg ?? ''),
    logoBgImage: String(data.logoBgImage ?? ''),
    themePrimary: String(data.themePrimary ?? ''),
    themeAccent: String(data.themeAccent ?? ''),
    themeBuy: String(data.themeBuy ?? ''),
    logoSlotCount: Number(data.logoSlotCount) || 0,
    logoFilledCount: Number(data.logoFilledCount) || 0,
    logoCropX: Number.isFinite(Number(data.logoCropX)) ? Number(data.logoCropX) : 50,
    logoCropY: Number.isFinite(Number(data.logoCropY)) ? Number(data.logoCropY) : 50,
    hasImageLayer: Boolean(data.hasImageLayer),
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
    src: String(data.src ?? ''),
    href: String(data.href ?? ''),
    imageWidth: Number(data.imageWidth) || 100,
    width: Number(data.rect?.width) || 0,
    height: Number(data.rect?.height) || 0,
  }
}

function logoPromptInputFrom(
  selection: VisualEditorSelection,
  websiteTitle: string,
  htmlPath: string,
  theme?: PartnerWebsiteTheme | null
): LogoSlotPromptInput {
  const resolved = theme ? resolveShopThemeColors(theme) : null
  return {
    shopTitle: websiteTitle || 'Shop',
    slot: selection.logoSlot,
    device: htmlPath.includes('.mobile.html') ? 'mobile' : 'desktop',
    bgColor: selection.logoBg || selection.bgColor || 'rgb(255, 255, 255)',
    width: selection.width,
    height: selection.height,
    primaryColor: selection.themePrimary || resolved?.primaryColor || '',
    accentColor: selection.themeAccent || resolved?.accentColor || '',
    buyButtonColor: selection.themeBuy || resolved?.buyButtonColor || '',
    bgImageUrl: selection.logoBgImage || '',
  }
}

const CHROME_WIDGET_ICONS: Record<VisualEditorChromeWidgetKind, LucideIcon> = {
  home: Home,
  products: Package,
  sale: Tag,
  cart: ShoppingBag,
  wishlist: Heart,
  'recently-viewed': Clock,
  chat: MessageCircle,
  account: User,
  login: LogIn,
  orders: ClipboardList,
  'order-tracking': Truck,
  wallet: Wallet,
  addresses: MapPin,
  'edit-profile': Pencil,
  notifications: Bell,
  security: Shield,
  'install-app': Download,
  contact: Phone,
  about: Info,
  faq: CircleHelp,
  shipping: Truck,
  returns: RotateCcw,
  payment: CreditCard,
  stores: Store,
  lookbook: Images,
  'size-guide': Ruler,
  blog: Newspaper,
  privacy: Lock,
  terms: FileText,
  'favorites-link': Heart,
  'orders-link': ClipboardList,
}

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
  onDirtyChange?: (dirty: boolean) => void
  onAdminLogoChange?: (url: string) => void
  /** Bump when iframe document is replaced (src → srcdoc freeze). */
  documentKey?: string
  /** Project HTML path for the page being edited (home = index.html). */
  htmlPath?: string
  /** Live shop URL for the page being edited. */
  viewHref?: string
  /** Màu giao diện đang chọn — gửi vào prompt tạo logo. */
  theme?: PartnerWebsiteTheme | null
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
  onDirtyChange,
  onAdminLogoChange,
  documentKey,
  htmlPath = 'index.html',
  viewHref,
  theme,
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
  const [addWidgetStyle, setAddWidgetStyle] = useState<VisualEditorChromeWidgetStyle>('icon-label')
  const [addBtnStyle, setAddBtnStyle] = useState<'hero' | 'primary' | 'outline'>('hero')
  const [addBtnLabel, setAddBtnLabel] = useState(t.visualEditAddButtonLabel)
  const [addBtnColor, setAddBtnColor] = useState('')
  const [addBtnBorder, setAddBtnBorder] = useState('#ffffff')
  const [addBtnHref, setAddBtnHref] = useState(siteSlug ? partnerSiteProductsPath(siteSlug) : '')
  const [addButtonPanelOpen, setAddButtonPanelOpen] = useState(false)
  const [addWidgetPlace, setAddWidgetPlace] = useState<VisualEditorChromeWidgetPlace>('header')
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [logoDrawActive, setLogoDrawActive] = useState(false)
  const [hiddenBlocks, setHiddenBlocks] = useState<HiddenBlock[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const addWidgetMenuRef = useRef<HTMLDivElement>(null)
  const insertBtnLockRef = useRef(false)
  const btnLabelFocusedRef = useRef(false)
  const btnHrefFocusedRef = useRef(false)
  const btnLabelInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)
  const scriptInjectedRef = useRef(false)
  const lastLogoKeyRef = useRef('')
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const aiLockRef = useRef(false)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!active) {
      setAddWidgetOpen(false)
      setAddButtonPanelOpen(false)
      setLogoDrawActive(false)
    }
  }, [active])

  useEffect(() => {
    if (!addWidgetOpen) return
    const onPointerDown = (ev: Event) => {
      const root = addWidgetMenuRef.current
      if (!root) return
      if (ev.target instanceof Node && root.contains(ev.target)) return
      setAddWidgetOpen(false)
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAddWidgetOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    const iframeDoc = iframeRef.current?.contentDocument
    iframeDoc?.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      iframeDoc?.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [addWidgetOpen, iframeRef])

  const injectScript = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow as (Window & { __nanoaiVeBound?: number }) | null
    if (!doc || !win) return
    postToIframe(iframe, 'deactivate')
    doc.getElementById('nanoai-visual-editor-script')?.remove()
    try {
      win.__nanoaiVeBound = 0
    } catch {
      /* ignore */
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
      postToIframe(iframe, 'activate', {
        device: htmlPath.includes('.mobile.html') ? 'mobile' : 'desktop',
      })
    }

    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') onLoad()

    return () => {
      iframe.removeEventListener('load', onLoad)
      postToIframe(iframe, 'deactivate')
    }
  }, [active, documentKey, htmlPath, iframeRef, injectScript])

  const handleSaveHtml = useCallback(
    async (rawHtml: string) => {
      setSaving(true)
      try {
        const iframe = iframeRef.current
        const doc = iframe?.contentDocument
        if (onSave) {
          const html = doc
            ? serializeVisualEditorHtml(doc, htmlPath.includes('.mobile.html') ? 'mobile' : 'desktop')
            : cleanSerializedHtml(rawHtml)
          const projectRaw = projectRef.current?.files?.length
            ? projectRef.current
            : { entryPath: 'index.html', files: [{ path: htmlPath, kind: 'html' as const, content: html }] }
          const next = mergeVisualHtmlIntoProject(projectRaw, html, htmlPath) as PartnerWebsiteProject
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
    [htmlPath, iframeRef, onError, onSave, onSaveShopHome, projectRef, t.visualEditSaveFailed]
  )

  useEffect(() => {
    if (!active) {
      setSelection(null)
      setDirty(false)
      setAiPrompt('')
      setRefUrl('')
      setHrefDraft('')
      setHiddenBlocks([])
      setCanUndo(false)
      setCanRedo(false)
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
        isChrome?: boolean
        chromeStyle?: string
        btnStyle?: string
        btnColor?: string
        btnBorder?: string
        text?: string
        isBgImage?: boolean
        isLogo?: boolean
        logoFace?: string
        logoSlot?: string
        logoBg?: string
        logoBgImage?: string
        themePrimary?: string
        themeAccent?: string
        themeBuy?: string
        logoSlotCount?: number
        logoFilledCount?: number
        logoCropX?: number
        logoCropY?: number
        hasImageLayer?: boolean
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
        canUndo?: boolean
        canRedo?: boolean
        dirty?: boolean
      }
      if (data?.source !== NANOAI_VE_MESSAGE) return

      if (data.type === 'select' || data.type === 'logoCreate') {
        const next = selectionFromMessage(data)
        setSelection(next)
        setHrefDraft(next.href)
        setUseCurrentRef(Boolean(next.src) && next.logoFace === 'image')
        if (next.isLogo) {
          const logoKey = `${next.logoSlot}:${Math.round(next.width)}x${Math.round(next.height)}:${next.logoBg}:${next.themePrimary}:${next.logoBgImage}`
          if (data.type === 'logoCreate' || lastLogoKeyRef.current !== logoKey) {
            lastLogoKeyRef.current = logoKey
            setAiPrompt(mergeLogoSlotPrompt('', logoPromptInputFrom(next, websiteTitle || 'Shop', htmlPath, theme)))
          }
        }
        if (data.type === 'logoCreate' && next.isLogo) {
          requestAnimationFrame(() => promptTextareaRef.current?.focus())
        }
        if (data.isButton && !data.isChrome) {
          setAddButtonPanelOpen(true)
          const label = String(data.text ?? '').trim()
          if (label && !btnLabelFocusedRef.current) setAddBtnLabel(label)
          if (data.btnStyle === 'hero' || data.btnStyle === 'primary' || data.btnStyle === 'outline') {
            setAddBtnStyle(data.btnStyle)
          }
          if (!btnLabelFocusedRef.current) {
            setAddBtnColor(String(data.btnColor ?? ''))
            if (data.btnBorder) setAddBtnBorder(String(data.btnBorder))
          }
          if (next.href && !btnHrefFocusedRef.current) setAddBtnHref(next.href)
        }
      }
      if (data.type === 'deselect') {
        setSelection(null)
        setHrefDraft('')
      }
      if (data.type === 'logoDrawStart') setLogoDrawActive(true)
      if (data.type === 'logoDrawEnd') setLogoDrawActive(false)
      if (data.type === 'ready' || data.type === 'loaded') {
        postToIframe(iframeRef.current, 'listHidden')
      }
      if (data.type === 'dirty') {
        setDirty(true)
        setCanUndo(true)
      }
      if (data.type === 'history') {
        setCanUndo(Boolean(data.canUndo))
        setCanRedo(Boolean(data.canRedo))
        if (typeof data.dirty === 'boolean') setDirty(data.dirty)
      }
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
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        e.stopPropagation()
        postToIframe(iframeRef.current, e.shiftKey ? 'redo' : 'undo')
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        e.stopPropagation()
        postToIframe(iframeRef.current, 'redo')
        return
      }
      if (!selection) return
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

  async function persistAdminLogo(url: string) {
    const result = await persistVisualEditorAdminLogo(partnerId, url)
    if (!result.ok) {
      onError(result.error || t.visualEditSaveFailed)
      return
    }
    onAdminLogoChange?.(url)
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
      postToIframe(iframeRef.current, 'setImageSrc', {
        url,
        allSlots: Boolean(selection?.isLogo && selection.logoFilledCount === 0),
      })
      setDirty(true)
      if (selection?.isLogo) await persistAdminLogo(url)
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

  async function requestGeneratedImage(input: {
    prompt: string
    kind: 'logo' | 'banner' | 'product_photo'
    aspectRatio: string
    referenceImageUrl?: string
    referenceImageUrls?: string[]
    referenceImageMeta?: Array<{ screenKey: string; label?: string }>
    allSlots?: boolean
    lockHeld?: boolean
  }) {
    if (!partnerId || (!input.lockHeld && aiLockRef.current)) return
    const prompt = input.prompt.trim()
    if (prompt.length < 4) {
      onError(t.visualEditAiPromptRequired)
      return
    }
    if (!input.lockHeld) {
      aiLockRef.current = true
      setAiBusy(true)
    }
    try {
      const refs = collectHttpImageUrls([
        ...(input.referenceImageUrls || []),
        input.referenceImageUrl,
      ])
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/visual-edit-image`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            prompt,
            referenceImageUrl: refs[0] || null,
            referenceImageUrls: refs,
            referenceImageMeta: input.referenceImageMeta?.slice(0, refs.length),
            title: websiteTitle || 'Partner website',
            kind: input.kind,
            aspectRatio: input.aspectRatio,
          }),
        }
      )
      const json = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
      if (!res.ok || !json.publicUrl) {
        onError(json.error || t.visualEditAiFailed)
        return
      }
      postToIframe(iframeRef.current, 'setImageSrc', { url: json.publicUrl, allSlots: Boolean(input.allSlots) })
      setDirty(true)
      if (input.kind === 'logo') await persistAdminLogo(json.publicUrl)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.visualEditAiFailed)
    } finally {
      if (!input.lockHeld) {
        aiLockRef.current = false
        setAiBusy(false)
      }
    }
  }

  async function handleGenerateAi() {
    if (!partnerId || !selection) return
    if (selection.isLogo) {
      if (aiLockRef.current) return
      aiLockRef.current = true
      setAiBusy(true)
      try {
      const ctx = logoPromptInputFrom(selection, websiteTitle || 'Shop', htmlPath, theme)
      const captured = await requestLogoContextFromIframe(iframeRef.current)
      if (captured?.bgColor) ctx.bgColor = captured.bgColor
      if (captured?.bgImageUrl) ctx.bgImageUrl = captured.bgImageUrl
      if (captured?.themePrimary) ctx.primaryColor = captured.themePrimary
      if (captured?.themeAccent) ctx.accentColor = captured.themeAccent
      if (captured?.themeBuy) ctx.buyButtonColor = captured.themeBuy
      const prompt = mergeLogoSlotPrompt(aiPrompt, ctx)
      const refs: string[] = []
      const meta: Array<{ screenKey: string; label?: string }> = []
      const contextDataUrl =
        captured?.dataUrl ||
        makeThemeSwatchDataUrl({
          bgColor: ctx.bgColor,
          primaryColor: ctx.primaryColor || '#111827',
          accentColor: ctx.accentColor || ctx.primaryColor || '#111827',
          buyButtonColor: ctx.buyButtonColor || ctx.primaryColor || '#111827',
        })
      const contextFile = dataUrlToPngFile(contextDataUrl, 'logo-theme-context.png')
      if (contextFile) {
        try {
          refs.push(await uploadPartnerImageFile(partnerId, contextFile))
          meta.push({ screenKey: 'logo_backdrop', label: 'Surrounding background + theme colors' })
        } catch {
          /* keep generating with prompt colors if upload fails */
        }
      }
      if (ctx.bgImageUrl && /^https?:\/\//i.test(ctx.bgImageUrl) && !refs.includes(ctx.bgImageUrl)) {
        refs.push(ctx.bgImageUrl)
        meta.push({ screenKey: 'logo_backdrop', label: 'Header/footer background image' })
      }
      const styleRef =
        refUrl.trim() ||
        (useCurrentRef && selection.logoFace === 'image' ? selection.src.trim() : '')
      if (styleRef) {
        refs.push(styleRef)
        meta.push({ screenKey: 'logo_style', label: 'Logo style reference' })
      }
      await requestGeneratedImage({
        prompt,
        kind: 'logo',
        aspectRatio: inferVisualEditImageKind(selection).aspectRatio,
        referenceImageUrls: refs,
        referenceImageMeta: meta,
        allSlots: selection.logoFilledCount === 0,
        lockHeld: true,
      })
      } catch (e) {
        onError(e instanceof Error ? e.message : t.visualEditAiFailed)
      } finally {
        aiLockRef.current = false
        setAiBusy(false)
      }
      return
    }
    const prompt = aiPrompt.trim()
    if (prompt.length < 4) {
      onError(t.visualEditAiPromptRequired)
      return
    }
    const inferred = inferVisualEditImageKind(selection)
    const referenceImageUrl = refUrl.trim() || (useCurrentRef ? selection.src.trim() : '')
    await requestGeneratedImage({
      prompt,
      kind: inferred.kind,
      aspectRatio: inferred.aspectRatio,
      referenceImageUrl: referenceImageUrl || undefined,
    })
  }

  function commitHref(next: string) {
    setHrefDraft(next)
    postToIframe(iframeRef.current, 'setHref', { href: next })
    setDirty(true)
  }

  function insertChromeWidget(kind: VisualEditorChromeWidgetKind, place: VisualEditorChromeWidgetPlace) {
    const slug = siteSlug?.trim()
    if (!slug) {
      onError(t.visualEditSaveFailed)
      return
    }
    const html = buildVisualEditorChromeWidgetHtml({
      kind,
      siteSlug: slug,
      locale,
      style: addWidgetStyle,
      place,
    })
    if (!html) return
    postToIframe(iframeRef.current, 'insertChromeBtn', {
      kind,
      html,
      host: chromeWidgetHost(kind, addWidgetStyle, place),
    })
    setDirty(true)
    setAddWidgetOpen(false)
  }

  function insertTextBlock() {
    postToIframe(iframeRef.current, 'insertText')
    setDirty(true)
    setAddWidgetOpen(false)
  }

  function insertButtonBlock() {
    if (insertBtnLockRef.current) return
    insertBtnLockRef.current = true
    window.setTimeout(() => {
      insertBtnLockRef.current = false
    }, 700)
    postToIframe(iframeRef.current, 'insertButton', {
      style: addBtnStyle,
      label: addBtnLabel.trim() || t.visualEditAddButtonLabel,
      href: addBtnHref.trim() || (siteSlug ? partnerSiteProductsPath(siteSlug) : ''),
      color: addBtnColor,
    })
    setDirty(true)
    setAddWidgetOpen(false)
    setAddButtonPanelOpen(true)
  }

  function applySelectedChromeStyle(style: VisualEditorChromeWidgetStyle) {
    postToIframe(iframeRef.current, 'setChromeStyle', { style })
    setDirty(true)
  }

  function applySelectedButtonStyle(style: 'hero' | 'primary' | 'outline') {
    postToIframe(iframeRef.current, 'setButtonStyle', { style })
    setDirty(true)
  }

  if (!active) return null

  const isBold = selection?.fontWeight === '700' || selection?.fontWeight === 'bold'
  const showImageTools = Boolean(selection?.isImage || selection?.isBgImage || selection?.isLogo)
  const logoActionLabel =
    selection?.logoFace === 'image' ? t.visualEditRecreateLogo : t.visualEditCreateLogo
  const hasRealLogoSrc = Boolean(selection?.isLogo && selection.logoFace === 'image' && selection.src)
  const showHref = Boolean(selection?.isButton || (selection && selection.href && selection.isText && !selection.isImage))
  const showChromeStyle = Boolean(selection?.isChrome)
  const showCtaStyle = Boolean(selection?.isButton && !selection.isChrome)
  const showBlockTools = Boolean(selection?.isBlock)
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
          <div className="relative" ref={addWidgetMenuRef}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'gap-1')}
              disabled={busy}
              title={t.visualEditAddWidget}
              aria-expanded={addWidgetOpen}
              aria-haspopup="menu"
              onClick={() => setAddWidgetOpen((open) => !open)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t.visualEditAddWidget}
            </Button>
            {addWidgetOpen ? (
            <div className="absolute left-0 top-full z-30 mt-1 flex w-[16.5rem] max-h-[min(70vh,24rem)] flex-col overflow-hidden rounded-md border bg-background shadow-lg">
              <div className="shrink-0 space-y-1 border-b p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                  disabled={busy}
                  onClick={insertTextBlock}
                >
                  <Type className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.visualEditAddText}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    insertButtonBlock()
                  }}
                >
                  <MousePointerClick className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.visualEditAddButton}
                </button>
                <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.visualEditAddStyleTitle}
                </p>
                <div className="flex gap-1 px-1">
                  {(
                    [
                      ['icon', t.visualEditAddStyleIcon],
                      ['icon-label', t.visualEditAddStyleIconLabel],
                      ['text', t.visualEditAddStyleText],
                    ] as const
                  ).map(([style, label]) => (
                    <button
                      key={style}
                      type="button"
                      className={cn(
                        'flex-1 rounded px-1.5 py-1 text-[10px] font-medium',
                        addWidgetStyle === style ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                      )}
                      disabled={busy}
                      onClick={() => setAddWidgetStyle(style)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 px-1 pb-0.5">
                  {VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS.map((group) => {
                    const tabTitle: Record<VisualEditorChromeWidgetPickerGroupId, string> = {
                      header: t.visualEditAddGroupHeader,
                      mid: t.visualEditAddGroupMid,
                      nav: t.visualEditAddGroupNav,
                    }
                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={cn(
                          'flex-1 rounded px-1.5 py-1 text-[10px] font-semibold',
                          addWidgetPlace === group.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        )}
                        disabled={busy}
                        onClick={() => setAddWidgetPlace(group.id)}
                      >
                        {tabTitle[group.id]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {(
                  VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS.find((group) => group.id === addWidgetPlace)
                    ?.kinds ?? []
                ).map((kind) => {
                  const Icon = CHROME_WIDGET_ICONS[kind]
                  return (
                    <button
                      key={`${addWidgetPlace}-${kind}`}
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted"
                      disabled={busy}
                      onClick={() => insertChromeWidget(kind, addWidgetPlace)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {chromeWidgetLabel(kind, locale)}
                    </button>
                  )
                })}
              </div>
            </div>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant={logoDrawActive ? 'default' : 'outline'}
            className={cn(btn, 'gap-1')}
            disabled={busy}
            title={t.visualEditAddLogoHint}
            onClick={() => {
              if (logoDrawActive) postToIframe(iframeRef.current, 'cancelAddLogo')
              else postToIframe(iframeRef.current, 'startAddLogo')
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            {t.visualEditAddLogo}
          </Button>
          {selection ? (
            <span className="max-w-[14rem] text-[10px] leading-tight text-muted-foreground">
              {t.visualEditNudgeHint}
            </span>
          ) : null}
          <p className={cn('font-medium text-primary', compact ? 'text-[10px]' : 'text-xs')}>
            {t.visualEditModeActive}
          </p>
          {selection?.hasImageLayer ? (
            <div className="flex overflow-hidden rounded-md border border-primary/40 bg-white">
              <Button
                type="button"
                size="sm"
                variant={selection.isBlock ? 'default' : 'ghost'}
                className={cn(btn, 'rounded-none')}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setLayerMode', { mode: 'block' })}
              >
                {t.visualEditLayerBlock}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selection.isImage || selection.isBgImage ? 'default' : 'ghost'}
                className={cn(btn, 'rounded-none')}
                disabled={busy}
                onClick={() => postToIframe(iframeRef.current, 'setLayerMode', { mode: 'image' })}
              >
                {t.visualEditLayerImage}
              </Button>
            </div>
          ) : null}
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
              {selection.isLogo ? (
                <>
                  <label className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">{t.visualEditLogoCropX}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selection.logoCropX}
                      className={slider}
                      disabled={busy}
                      onChange={(e) =>
                        postToIframe(iframeRef.current, 'setLogoCrop', {
                          x: Number(e.target.value),
                          y: selection.logoCropY,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">{t.visualEditLogoCropY}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selection.logoCropY}
                      className={slider}
                      disabled={busy}
                      onChange={(e) =>
                        postToIframe(iframeRef.current, 'setLogoCrop', {
                          x: selection.logoCropX,
                          y: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
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
              variant="outline"
              className={cn(btn, 'gap-1')}
              disabled={busy || !canUndo}
              title={`${t.visualEditUndo} (Ctrl+Z)`}
              onClick={() => postToIframe(iframeRef.current, 'undo')}
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              {compact ? null : t.visualEditUndo}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(btn, 'gap-1')}
              disabled={busy || !canRedo}
              title={`${t.visualEditRedo} (Ctrl+Y)`}
              onClick={() => postToIframe(iframeRef.current, 'redo')}
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden />
              {compact ? null : t.visualEditRedo}
            </Button>
            {viewHref ? (
              <Button type="button" size="sm" variant="outline" className={cn(btn, 'gap-1')} asChild>
                <a href={viewHref} target="_blank" rel="noopener noreferrer" title={t.visualEditViewSite}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t.visualEditViewSite}
                </a>
              </Button>
            ) : null}
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

        {showChromeStyle && selection ? (
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="shrink-0 text-muted-foreground">{t.visualEditAddStyleTitle}</span>
            {(
              [
                ['icon', t.visualEditAddStyleIcon],
                ['icon-label', t.visualEditAddStyleIconLabel],
                ['text', t.visualEditAddStyleText],
              ] as const
            ).map(([style, label]) => (
              <Button
                key={style}
                type="button"
                size="sm"
                variant={selection.chromeStyle === style ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => applySelectedChromeStyle(style)}
              >
                {label}
              </Button>
            ))}
          </div>
        ) : null}

        {(addButtonPanelOpen || showCtaStyle) ? (
          <div
            className={cn(
              'flex flex-wrap items-center rounded-md border bg-background/90',
              compact ? 'gap-1 p-1.5' : 'gap-1.5 p-2'
            )}
          >
            <span className="shrink-0 text-[10px] font-semibold">{t.visualEditAddButton}</span>
            <label className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAddButtonColor}</span>
              <input
                type="color"
                value={addBtnColor || rgbToHex(selection?.bgColor || '') || '#ffffff'}
                className={cn('cursor-pointer rounded border p-0.5', compact ? 'h-6 w-7' : 'h-7 w-9')}
                disabled={busy}
                onChange={(e) => {
                  const color = e.target.value
                  setAddBtnColor(color)
                  postToIframe(iframeRef.current, 'setButtonColor', { color })
                  setDirty(true)
                }}
              />
            </label>
            <label className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground">{t.visualEditAddButtonBorder}</span>
              <input
                type="color"
                value={addBtnBorder || selection?.btnBorder || '#ffffff'}
                className={cn('cursor-pointer rounded border p-0.5', compact ? 'h-6 w-7' : 'h-7 w-9')}
                disabled={busy}
                onChange={(e) => {
                  const color = e.target.value
                  setAddBtnBorder(color)
                  postToIframe(iframeRef.current, 'setButtonBorder', { color })
                  setDirty(true)
                }}
              />
            </label>
            <input
              ref={btnLabelInputRef}
              type="text"
              value={addBtnLabel}
              placeholder={t.visualEditAddButtonText}
              className={cn(
                'min-w-[7rem] rounded-md border bg-background px-2',
                compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
              )}
              disabled={busy}
              onFocus={() => {
                btnLabelFocusedRef.current = true
              }}
              onBlur={() => {
                btnLabelFocusedRef.current = false
              }}
              onChange={(e) => {
                const input = e.currentTarget
                const start = input.selectionStart
                const end = input.selectionEnd
                const text = input.value
                setAddBtnLabel(text)
                postToIframe(iframeRef.current, 'setButtonLabel', { text })
                setDirty(true)
                requestAnimationFrame(() => {
                  const el = btnLabelInputRef.current
                  if (!el || start == null || end == null) return
                  try {
                    el.setSelectionRange(start, end)
                  } catch {
                    /* ignore */
                  }
                })
              }}
            />
            {(
              [
                ['hero', t.visualEditBtnStyleHero],
                ['primary', t.visualEditBtnStylePrimary],
                ['outline', t.visualEditBtnStyleOutline],
              ] as const
            ).map(([style, label]) => (
              <Button
                key={style}
                type="button"
                size="sm"
                variant={(selection?.btnStyle || addBtnStyle) === style ? 'default' : 'outline'}
                className={btn}
                disabled={busy}
                onClick={() => {
                  setAddBtnStyle(style)
                  applySelectedButtonStyle(style)
                }}
              >
                {label}
              </Button>
            ))}
            <input
              type="text"
              value={addBtnHref}
              placeholder={t.visualEditButtonHrefPlaceholder}
              className={cn(
                'min-w-[12rem] flex-1 rounded-md border bg-background px-2',
                compact ? 'h-6 text-[10px]' : 'h-8 text-xs'
              )}
              disabled={busy}
              onFocus={() => {
                btnHrefFocusedRef.current = true
              }}
              onChange={(e) => {
                setAddBtnHref(e.target.value)
                setHrefDraft(e.target.value)
              }}
              onBlur={(e) => {
                btnHrefFocusedRef.current = false
                commitHref(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitHref(addBtnHref)
                }
              }}
            />
          </div>
        ) : null}

        {showHref && selection && !showCtaStyle && !addButtonPanelOpen ? (
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
              compact && !selection.isLogo ? 'gap-1 p-1.5' : 'gap-2 p-2'
            )}
          >
            {compact && !selection.isLogo ? null : (
              <>
                <p className="text-xs font-medium">
                  {selection.isLogo ? logoActionLabel : t.visualEditAiImageTitle}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selection.isLogo ? t.visualEditLogoHint : t.visualEditAiImageHint}
                </p>
              </>
            )}
            <label className="flex min-w-0 flex-col gap-1" htmlFor="nanoai-ve-ai-prompt">
              <span className={cn(selection.isLogo ? 'text-[11px] font-medium' : 'sr-only')}>
                {selection.isLogo ? t.visualEditLogoPromptLabel : t.visualEditAiPromptLabel}
              </span>
              <textarea
                id="nanoai-ve-ai-prompt"
                ref={promptTextareaRef}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  selection.isLogo ? t.visualEditLogoPromptPlaceholder : t.visualEditAiImagePlaceholder
                }
                rows={selection.isLogo ? 3 : compact ? 1 : 2}
                disabled={busy}
                className={cn(
                  'w-full resize-y rounded-md border bg-background px-2 py-1',
                  compact && !selection.isLogo ? 'text-[10px]' : 'text-xs'
                )}
              />
            </label>
            {selection.isLogo ? (
              <div className="flex flex-col gap-1.5 rounded-md border border-dashed bg-muted/20 p-1.5">
                <span className="text-[11px] font-medium">{t.visualEditLogoReferenceLabel}</span>
                <p className="text-[10px] text-muted-foreground">{t.visualEditLogoReferenceHint}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {refUrl || hasRealLogoSrc ? (
                    <img
                      src={refUrl || selection.src}
                      alt=""
                      className="h-12 w-16 rounded border bg-white object-contain"
                    />
                  ) : null}
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
                    {uploadBusy ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1 h-3 w-3" />
                    )}
                    {t.visualEditUploadReference}
                  </Button>
                  {refUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={btn}
                      disabled={busy}
                      onClick={() => {
                        setRefUrl('')
                        setUseCurrentRef(false)
                      }}
                    >
                      {t.visualEditRemoveReference}
                    </Button>
                  ) : null}
                  {hasRealLogoSrc ? (
                    <label className="flex items-center gap-1 text-[10px]">
                      <input
                        type="checkbox"
                        checked={useCurrentRef && !refUrl}
                        disabled={busy}
                        onChange={(e) => {
                          setUseCurrentRef(e.target.checked)
                          if (e.target.checked) setRefUrl('')
                        }}
                      />
                      {t.visualEditUseCurrentAsRef}
                    </label>
                  ) : null}
                </div>
              </div>
            ) : (
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
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
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
                {selection.isLogo ? logoActionLabel : t.visualEditCreateWithAi}
              </Button>
              {hasRealLogoSrc ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={btn}
                  disabled={busy}
                  onClick={() => {
                    postToIframe(iframeRef.current, 'setImageSrc', { url: selection.src, allSlots: true })
                    setDirty(true)
                    void persistAdminLogo(selection.src)
                  }}
                >
                  {t.visualEditApplyLogoAll}
                </Button>
              ) : null}
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
