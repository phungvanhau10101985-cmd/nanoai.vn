'use client'

import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Laptop, Monitor, Smartphone, Tablet, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { FashionHomeCopyPatch } from '@/lib/partner-website/shop/build-fashion-home-copy'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  applyThemeCssVarsToFrameWindow,
  rewriteThemeCssVarsInHtml,
  themeCssVarMap,
} from '@/lib/partner-website/template/partner-website-theme-tokens'
import { NANOAI_VE_MESSAGE } from '@/lib/partner-website/visual-editor/build-visual-editor-script'
import { PartnerWebsiteVisualEditorToolbar } from '@/components/partner-website/partner-website-visual-editor-toolbar'
import {
  PartnerWebsiteThemeColorPicker,
  useDebouncedThemeSave,
} from '@/components/partner-website/partner-website-theme-color-picker'
import {
  freezeDocumentForVisualEditor,
  resolveSavedVisualEditorHtml,
  visualHtmlLooksUsable,
} from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import {
  categoryPathFromSitePath,
  cmsSlugFromSitePath,
  isVisualEditorPageKey,
  pageKeyFromSitePath,
  productKeyFromSitePath,
  resolveExactVisualCategoryHtml,
  resolveExactVisualCmsHtml,
  resolveExactVisualPageHtml,
  isolateVisualHtmlForDevice,
  resolveExactVisualProductHtml,
  resolveSavedVisualPageHtml,
  resolveVisualProductIdFromKey,
  normalizeVisualCmsSlug,
  normalizeVisualProductId,
  VISUAL_EDITOR_PAGE_KEYS,
  visualEditorDeviceVariant,
  visualEditorPreviewPath,
  visualEditorTargetHtmlPath,
  appendVisualDeviceQuery,
  VISUAL_MOBILE_PREVIEW_PX,
  VISUAL_TABLET_PREVIEW_PX,
  VISUAL_DESKTOP_MIN_PX,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { copyMissingChromeCountBadgeWidgets } from '@/lib/partner-website/shop/chrome-count-badges'
import {
  applySharedChrome,
  extractSharedChrome,
  hasSharedChrome,
} from '@/lib/partner-website/shop/sync-shared-chrome'
import {
  mergeVisualHomeStylesIntoHtml,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'
import {
  resolvePartnerCategoryDisplayName,
  type PartnerCategoryTreeNode,
} from '@/lib/partner-website/category/partner-category-types'
import {
  partnerSiteCategoriesApiPath,
  partnerSiteProductsApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { buildPartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'
import {
  pageCatalogLabels,
  type PartnerWebsitePageKey,
} from '@/lib/partner-website/partner-website-page-catalog'

export type PartnerWebsitePreviewDevice = 'mobile' | 'tablet' | 'laptop' | 'desktop'

type PersistedVisualEditState = {
  device: PartnerWebsitePreviewDevice
  pageKey: PartnerWebsitePageKey
  categoryPath: string | null
  productId: string | null
  productKey: string | null
  cmsSlug: string | null
  active: boolean
}

const VISUAL_EDIT_STATE_PREFIX = 'nanoai:partner-website-visual-edit-state:'

function visualEditStateStorageKey(partnerId: string): string {
  return `${VISUAL_EDIT_STATE_PREFIX}${partnerId || 'unknown'}`
}

function parsePreviewDevice(raw: string | null | undefined): PartnerWebsitePreviewDevice | null {
  return raw === 'mobile' || raw === 'tablet' || raw === 'laptop' || raw === 'desktop' ? raw : null
}

function safeDecode(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim()
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizePersistedVisualEditState(raw: Partial<PersistedVisualEditState> | null): PersistedVisualEditState {
  const productId = safeDecode(raw?.productId)
  const productKey = safeDecode(raw?.productKey)
  const categoryPath = safeDecode(raw?.categoryPath)
  const cmsSlug = safeDecode(raw?.cmsSlug)
  const pageKey =
    raw?.pageKey && isVisualEditorPageKey(raw.pageKey)
      ? raw.pageKey
      : productId || productKey
        ? 'product_detail'
        : categoryPath
          ? 'collection'
          : 'home'
  return {
    device: parsePreviewDevice(raw?.device) ?? 'desktop',
    pageKey,
    categoryPath: pageKey === 'collection' ? categoryPath : null,
    productId: pageKey === 'product_detail' ? productId : null,
    productKey: pageKey === 'product_detail' ? productKey || productId : null,
    cmsSlug: cmsSlug,
    active: Boolean(raw?.active),
  }
}

function readPersistedVisualEditState(partnerId: string): PersistedVisualEditState {
  if (typeof window === 'undefined') return normalizePersistedVisualEditState(null)
  const params = new URLSearchParams(window.location.search)
  const fromQuery: Partial<PersistedVisualEditState> = {
    device: parsePreviewDevice(params.get('veDevice')) ?? undefined,
    pageKey: isVisualEditorPageKey(params.get('vePage') || '') ? (params.get('vePage') as PartnerWebsitePageKey) : undefined,
    categoryPath: params.get('veCat'),
    productId: params.get('veProduct'),
    productKey: params.get('veProductKey'),
    cmsSlug: params.get('veCms'),
    active: params.get('ve') === '1',
  }
  if (fromQuery.device || fromQuery.pageKey || fromQuery.categoryPath || fromQuery.productId || fromQuery.cmsSlug || fromQuery.active) {
    return normalizePersistedVisualEditState(fromQuery)
  }
  try {
    const raw = window.localStorage.getItem(visualEditStateStorageKey(partnerId))
    if (raw) return normalizePersistedVisualEditState(JSON.parse(raw) as Partial<PersistedVisualEditState>)
  } catch {
    /* ignore */
  }
  return normalizePersistedVisualEditState(null)
}

function persistVisualEditState(partnerId: string, state: PersistedVisualEditState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(visualEditStateStorageKey(partnerId), JSON.stringify(state))
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('veDevice', state.device)
    url.searchParams.set('vePage', state.pageKey)
    if (state.categoryPath) url.searchParams.set('veCat', state.categoryPath)
    else url.searchParams.delete('veCat')
    if (state.productId) url.searchParams.set('veProduct', state.productId)
    else url.searchParams.delete('veProduct')
    if (state.productKey) url.searchParams.set('veProductKey', state.productKey)
    else url.searchParams.delete('veProductKey')
    if (state.cmsSlug) url.searchParams.set('veCms', state.cmsSlug)
    else url.searchParams.delete('veCms')
    if (state.active) url.searchParams.set('ve', '1')
    else url.searchParams.delete('ve')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    /* ignore */
  }
}

export type PartnerWebsiteDevicePreviewHandle = {
  openVisualEdit: () => void
}

type VisualEditLeaveIntent =
  | { kind: 'device'; next: PartnerWebsitePreviewDevice }
  | { kind: 'page'; next: string }
  | { kind: 'view' }
  | { kind: 'exit' }

const DEVICE_WIDTH: Record<PartnerWebsitePreviewDevice, number | 'full'> = {
  mobile: VISUAL_MOBILE_PREVIEW_PX,
  tablet: VISUAL_TABLET_PREVIEW_PX,
  laptop: VISUAL_DESKTOP_MIN_PX,
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
  onVisualEditSave?: (
    project: PartnerWebsiteProject,
    pageKey: PartnerWebsitePageKey,
    device: VisualDeviceVariant,
    extras?: { categoryPath?: string | null; productId?: string | null; cmsSlug?: string | null }
  ) => Promise<void>
  onShopHomeSave?: (patch: FashionHomeCopyPatch) => Promise<void>
  onVisualEditError?: (message: string) => void
  onLiveThemeChange?: (theme: PartnerWebsiteTheme) => void
  onThemePersisted?: (
    theme: PartnerWebsiteTheme,
    extras?: { htmlSource?: string | null; project?: PartnerWebsiteProject }
  ) => void
  onAdminLogoChange?: (url: string) => void
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
    onAdminLogoChange,
    onShopHomeSave,
    htmlSource,
    useVisualHtml = false,
  },
  ref
) {
  const t = getPartnerWebsiteCopy(locale)
  const pageLabels = pageCatalogLabels(locale)
  const initialVisualEditStateRef = useRef<PersistedVisualEditState | null>(null)
  if (!initialVisualEditStateRef.current) initialVisualEditStateRef.current = readPersistedVisualEditState(partnerId)
  const initialVisualEditState = initialVisualEditStateRef.current
  const [device, setDevice] = useState<PartnerWebsitePreviewDevice>(initialVisualEditState.device)
  const [previewPageKey, setPreviewPageKey] = useState<PartnerWebsitePageKey>(initialVisualEditState.pageKey)
  const [previewCategoryPath, setPreviewCategoryPath] = useState<string | null>(initialVisualEditState.categoryPath)
  const [previewProductId, setPreviewProductId] = useState<string | null>(initialVisualEditState.productId)
  const [previewProductKey, setPreviewProductKey] = useState<string | null>(initialVisualEditState.productKey)
  const [previewCmsSlug, setPreviewCmsSlug] = useState<string | null>(initialVisualEditState.cmsSlug)
  const [categoryOptions, setCategoryOptions] = useState<Array<{ path: string; name: string; depth: number }>>(
    []
  )
  const [productOptions, setProductOptions] = useState<Array<{ id: string; name: string; key: string }>>([])
  const [cmsOptions, setCmsOptions] = useState<Array<{ slug: string; title: string }>>([])
  const [visualEditActive, setVisualEditActive] = useState(false)
  const [editSrcDoc, setEditSrcDoc] = useState<string | null>(null)
  const [editDirty, setEditDirty] = useState(false)
  const [leaveIntent, setLeaveIntent] = useState<VisualEditLeaveIntent | null>(null)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [freezeTick, setFreezeTick] = useState(0)
  const [portalReady, setPortalReady] = useState(false)
  const editVariant = visualEditorDeviceVariant(device)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const projectRef = useRef<PartnerWebsiteProject | null>(null)
  const freezeLockRef = useRef(false)
  const flushedHtmlByVariantRef = useRef<Partial<Record<VisualDeviceVariant, string>>>({})
  const saveFnRef = useRef<(() => Promise<boolean>) | null>(null)
  const restoredVisualEditActiveRef = useRef(false)
  projectRef.current = project ?? null

  const { saving: themeSaving, schedule: scheduleThemeSave } = useDebouncedThemeSave(
    partnerId,
    (theme, extras) =>
      onThemePersisted?.(theme, extras as { htmlSource?: string | null; project?: PartnerWebsiteProject }),
    () => onVisualEditError?.(t.themeColorSaveError)
  )

  function handleThemeLive(next: PartnerWebsiteTheme) {
    onLiveThemeChange?.(next)
    scheduleThemeSave(next)
  }

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    persistVisualEditState(partnerId, {
      device,
      pageKey: previewPageKey,
      categoryPath: previewCategoryPath,
      productId: previewProductId,
      productKey: previewProductKey,
      cmsSlug: previewCmsSlug,
      active: visualEditActive,
    })
  }, [partnerId, device, previewPageKey, previewCategoryPath, previewProductId, previewProductKey, previewCmsSlug, visualEditActive])

  useEffect(() => {
    const slug = siteSlug?.trim()
    if (!slug) {
      setCategoryOptions([])
      return
    }
    let cancelled = false
    fetch(partnerSiteCategoriesApiPath(slug))
      .then((res) => res.json())
      .then((json: { tree?: PartnerCategoryTreeNode[] }) => {
        if (cancelled) return
        const flat: Array<{ path: string; name: string; depth: number }> = []
        const walk = (nodes: PartnerCategoryTreeNode[]) => {
          for (const node of nodes) {
            flat.push({
              path: node.path,
              name: resolvePartnerCategoryDisplayName(node, locale),
              depth: node.depth,
            })
            if (node.children?.length) walk(node.children)
          }
        }
        walk(Array.isArray(json.tree) ? json.tree : [])
        setCategoryOptions(flat)
      })
      .catch(() => {
        if (!cancelled) setCategoryOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug, locale])

  useEffect(() => {
    const slug = siteSlug?.trim()
    if (!slug) {
      setProductOptions([])
      return
    }
    let cancelled = false
    fetch(`${partnerSiteProductsApiPath(slug)}?limit=48`)
      .then((res) => res.json())
      .then((json: { products?: Array<{ id?: string; name?: string }> }) => {
        if (cancelled) return
        const next = (Array.isArray(json.products) ? json.products : [])
          .map((p) => {
            const id = typeof p.id === 'string' ? normalizeVisualProductId(p.id) : ''
            if (!id) return null
            const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : id
            return { id, name, key: buildPartnerSiteProductKey(name, id) }
          })
          .filter((p): p is { id: string; name: string; key: string } => Boolean(p))
        setProductOptions(next)
      })
      .catch(() => {
        if (!cancelled) setProductOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [siteSlug])

  useEffect(() => {
    if (!partnerId) {
      setCmsOptions([])
      return
    }
    let cancelled = false
    fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/static-pages`)
      .then((res) => res.json())
      .then((json: { pages?: Array<{ slug?: string; title?: string; isPublished?: boolean }> }) => {
        if (cancelled) return
        const next = (Array.isArray(json.pages) ? json.pages : [])
          .filter((p) => p.isPublished !== false)
          .map((p) => {
            const slug = typeof p.slug === 'string' ? normalizeVisualCmsSlug(p.slug) : ''
            if (!slug) return null
            return { slug, title: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : slug }
          })
          .filter((p): p is { slug: string; title: string } => Boolean(p))
        setCmsOptions(next)
      })
      .catch(() => {
        if (!cancelled) setCmsOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [partnerId])

  useEffect(() => {
    if (!previewProductKey || previewProductId) return
    const id = resolveVisualProductIdFromKey(previewProductKey, productOptions)
    if (id) setPreviewProductId(id)
  }, [previewProductKey, previewProductId, productOptions])

  function isEditingHomePage() {
    return previewPageKey === 'home' && !previewCategoryPath && !previewProductId && !previewCmsSlug
  }

  function applyHomeChromeToEditorHtml(html: string): string {
    if (isEditingHomePage()) return html
    const homeRaw = resolveExactVisualPageHtml(
      { htmlSource, project, theme: liveTheme },
      'home',
      editVariant
    )
    if (!visualHtmlLooksUsable(homeRaw)) return html
    const home = isolateVisualHtmlForDevice(homeRaw, editVariant)
    const chrome = extractSharedChrome(home.length >= 40 ? home : homeRaw)
    if (!hasSharedChrome(chrome)) return html
    const next = applySharedChrome(html, chrome, { targetVariant: editVariant })
    return mergeVisualHomeStylesIntoHtml(next, preferredVisualHomeStyleSource(home, homeRaw))
  }

  function visualEditSrcDoc(html: string): string {
    const withChrome = applyHomeChromeToEditorHtml(html)
    const laidOut = injectPartnerShopChromeLayoutCss(stripEmptyLogoPlaceholdersFromHtml(withChrome))
    return liveTheme ? rewriteThemeCssVarsInHtml(laidOut, liveTheme) : laidOut
  }

  function savedHtmlForVariant(variant: VisualDeviceVariant): string {
    const flushed = flushedHtmlByVariantRef.current[variant]
    if (flushed && visualHtmlLooksUsable(flushed)) {
      return isolateVisualHtmlForDevice(flushed, variant)
    }

    const seedFrom = (sourceHtml: string): string => {
      if (variant === 'desktop' || !visualHtmlLooksUsable(sourceHtml)) return ''
      return withSyncedCountBadges(
        isolateVisualHtmlForDevice(sourceHtml, variant, { stripAddedChrome: true }),
        variant
      )
    }

    const websitePick = { htmlSource, project, theme: liveTheme }

    if (previewProductId) {
      const exact = resolveExactVisualProductHtml(websitePick, previewProductId, variant)
      if (visualHtmlLooksUsable(exact)) {
        return isolateVisualHtmlForDevice(exact, variant)
      }
      if (variant === 'tablet') {
        const fromMobile = seedFrom(resolveExactVisualProductHtml(websitePick, previewProductId, 'mobile'))
        if (fromMobile) return fromMobile
      }
      return seedFrom(resolveExactVisualProductHtml(websitePick, previewProductId, 'desktop'))
    }
    if (previewCmsSlug) {
      const exact = resolveExactVisualCmsHtml(websitePick, previewCmsSlug, variant)
      if (visualHtmlLooksUsable(exact)) {
        return isolateVisualHtmlForDevice(exact, variant)
      }
      if (variant === 'tablet') {
        const fromMobile = seedFrom(resolveExactVisualCmsHtml(websitePick, previewCmsSlug, 'mobile'))
        if (fromMobile) return fromMobile
      }
      return seedFrom(resolveExactVisualCmsHtml(websitePick, previewCmsSlug, 'desktop'))
    }
    if (previewCategoryPath) {
      const exact = resolveExactVisualCategoryHtml(websitePick, previewCategoryPath, variant)
      if (visualHtmlLooksUsable(exact)) {
        return isolateVisualHtmlForDevice(exact, variant)
      }
      if (variant === 'tablet') {
        const fromMobile = seedFrom(resolveExactVisualCategoryHtml(websitePick, previewCategoryPath, 'mobile'))
        if (fromMobile) return fromMobile
      }
      return seedFrom(resolveExactVisualCategoryHtml(websitePick, previewCategoryPath, 'desktop'))
    }
    const exact = resolveExactVisualPageHtml(websitePick, previewPageKey, variant)
    if (visualHtmlLooksUsable(exact)) {
      return isolateVisualHtmlForDevice(exact, variant)
    }
    if (variant === 'tablet') {
      const fromMobile = seedFrom(resolveExactVisualPageHtml(websitePick, previewPageKey, 'mobile'))
      if (fromMobile) return fromMobile
    }
    const desktopPage = resolveExactVisualPageHtml(websitePick, previewPageKey, 'desktop')
    const seeded = seedFrom(desktopPage)
    if (seeded) return seeded
    if (variant !== 'desktop' && previewPageKey === 'home' && useVisualHtml) {
      const home = resolveSavedVisualEditorHtml({ htmlSource, project })
      return withSyncedCountBadges(
        isolateVisualHtmlForDevice(home, variant, { stripAddedChrome: true }),
        variant
      )
    }
    if (previewPageKey !== 'home') {
      return isolateVisualHtmlForDevice(
        resolveSavedVisualPageHtml({
          pageKey: previewPageKey,
          variant,
          htmlSource,
          project,
          theme: liveTheme,
        }),
        variant
      )
    }
    return ''
  }

  function countBadgeSourceHtmls(variant: VisualDeviceVariant): string[] {
    const websitePick = { htmlSource, project, theme: liveTheme }
    const out: string[] = []
    const push = (html: string) => {
      if (html.trim() && visualHtmlLooksUsable(html)) out.push(html)
    }
    ;(['desktop', 'tablet', 'mobile'] as VisualDeviceVariant[]).forEach((other) => {
      if (other === variant) return
      push(flushedHtmlByVariantRef.current[other] || '')
    })
    if (previewProductId) {
      ;(['desktop', 'tablet', 'mobile'] as VisualDeviceVariant[]).forEach((other) => {
        if (other === variant) return
        push(resolveExactVisualProductHtml(websitePick, previewProductId, other))
      })
      return out
    }
    if (previewCmsSlug) {
      ;(['desktop', 'tablet', 'mobile'] as VisualDeviceVariant[]).forEach((other) => {
        if (other === variant) return
        push(resolveExactVisualCmsHtml(websitePick, previewCmsSlug, other))
      })
      return out
    }
    if (previewCategoryPath) {
      ;(['desktop', 'tablet', 'mobile'] as VisualDeviceVariant[]).forEach((other) => {
        if (other === variant) return
        push(resolveExactVisualCategoryHtml(websitePick, previewCategoryPath, other))
      })
      return out
    }
    ;(['desktop', 'tablet', 'mobile'] as VisualDeviceVariant[]).forEach((other) => {
      if (other === variant) return
      push(resolveExactVisualPageHtml(websitePick, previewPageKey, other))
    })
    if (previewPageKey === 'home') {
      push(resolveSavedVisualEditorHtml({ htmlSource, project }))
    }
    return out
  }

  function withSyncedCountBadges(html: string, variant: VisualDeviceVariant): string {
    if (!html.trim()) return html
    let next = html
    for (const source of countBadgeSourceHtmls(variant)) {
      next = copyMissingChromeCountBadgeWidgets(source, next, variant)
    }
    return isolateVisualHtmlForDevice(next, variant)
  }

  function startVisualEdit() {
    if (!visualEditEnabled || quickEditDisabled || !hasWebsite) return
    if (!onVisualEditSave && !onShopHomeSave) return
    flushedHtmlByVariantRef.current = {}
    setEditDirty(false)
    const saved = savedHtmlForVariant(editVariant)
    if (visualHtmlLooksUsable(saved)) {
      freezeLockRef.current = true
      setEditSrcDoc(visualEditSrcDoc(saved))
    } else {
      freezeLockRef.current = false
      setEditSrcDoc(null)
    }
    setVisualEditActive(true)
  }

  function applyDevice(next: PartnerWebsitePreviewDevice) {
    flushedHtmlByVariantRef.current = {}
    const nextVariant = visualEditorDeviceVariant(next)
    setEditDirty(false)
    if (visualEditActive) {
      const saved = savedHtmlForVariant(nextVariant)
      if (visualHtmlLooksUsable(saved)) {
        freezeLockRef.current = true
        setEditSrcDoc(visualEditSrcDoc(saved))
      } else {
        freezeLockRef.current = false
        setEditSrcDoc(null)
      }
    }
    setDevice(next)
  }

  function applyPageSelect(next: string) {
    if (visualEditActive) {
      flushedHtmlByVariantRef.current = {}
      freezeLockRef.current = false
      setEditSrcDoc(null)
      setEditDirty(false)
    }
    if (next.startsWith('c:')) {
      setPreviewPageKey('collection')
      setPreviewCategoryPath(next.slice(2))
      setPreviewProductId(null)
      setPreviewProductKey(null)
      setPreviewCmsSlug(null)
      return
    }
    if (next.startsWith('p:')) {
      const id = next.slice(2)
      const hit = productOptions.find((p) => p.id === id)
      setPreviewPageKey('product_detail')
      setPreviewProductId(id)
      setPreviewProductKey(hit?.key ?? id)
      setPreviewCategoryPath(null)
      setPreviewCmsSlug(null)
      return
    }
    if (next.startsWith('cms:')) {
      setPreviewCmsSlug(next.slice(4))
      setPreviewCategoryPath(null)
      setPreviewProductId(null)
      setPreviewProductKey(null)
      return
    }
    if (isVisualEditorPageKey(next) && next !== 'collection' && next !== 'product_detail') {
      setPreviewPageKey(next)
      clearDynamicPreview()
    }
  }

  function openLiveViewNow() {
    const slug = siteSlug?.trim()
    if (!slug) return
    const href = appendVisualDeviceQuery(
      `${visualEditorPreviewPath(
        slug,
        previewPageKey,
        previewCategoryPath,
        previewProductKey,
        previewCmsSlug
      )}?v=${Date.now()}`,
      editVariant
    )
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  function exitVisualEdit() {
    flushedHtmlByVariantRef.current = {}
    freezeLockRef.current = false
    setEditSrcDoc(null)
    setEditDirty(false)
    setVisualEditActive(false)
  }

  function fulfillLeave(intent: VisualEditLeaveIntent) {
    if (intent.kind === 'device') applyDevice(intent.next)
    else if (intent.kind === 'page') applyPageSelect(intent.next)
    else if (intent.kind === 'view') openLiveViewNow()
    else exitVisualEdit()
  }

  function requestLeave(intent: VisualEditLeaveIntent) {
    if (!editDirty) {
      fulfillLeave(intent)
      return
    }
    setLeaveIntent(intent)
  }

  async function resolveLeave(mode: 'save' | 'discard' | 'stay') {
    if (mode === 'stay' || !leaveIntent) {
      setLeaveIntent(null)
      return
    }
    const intent = leaveIntent
    if (mode === 'save') {
      setLeaveBusy(true)
      try {
        const ok = (await saveFnRef.current?.()) ?? false
        if (!ok) return
      } finally {
        setLeaveBusy(false)
      }
    }
    setLeaveIntent(null)
    fulfillLeave(intent)
  }

  function changeDevice(next: PartnerWebsitePreviewDevice) {
    const nextVariant = visualEditorDeviceVariant(next)
    if (visualEditActive && nextVariant !== visualEditorDeviceVariant(device)) {
      requestLeave({ kind: 'device', next })
      return
    }
    setDevice(next)
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

    const saved = savedHtmlForVariant(editVariant)
    if (visualHtmlLooksUsable(saved)) {
      freezeLockRef.current = true
      setEditSrcDoc(visualEditSrcDoc(saved))
      return
    }

    const iframe = iframeRef.current
    if (!iframe) {
      const retry = window.setTimeout(() => setFreezeTick((n) => n + 1), 60)
      return () => window.clearTimeout(retry)
    }

    let cancelled = false

    const isBlankDoc = (doc: Document | null): boolean => {
      if (!doc) return true
      try {
        return doc.location?.href === 'about:blank'
      } catch {
        return false
      }
    }

    const pageLooksReady = (doc: Document | null): boolean => {
      if (!doc?.body || isBlankDoc(doc)) return false
      return Boolean(
        doc.querySelector(
          '.pw-shop, [data-pw-edit], header.pw-header, header.pw-shop-header, .pw-shop-header, .pw-header, .pw-hero, .pw-shop-main'
        )
      )
    }

    const shopDocFromPreview = (doc: Document | null): Document | null => {
      if (!doc || isBlankDoc(doc)) return null
      const inner = doc.querySelector(
        'iframe[srcdoc], iframe[title="Landing page"]'
      ) as HTMLIFrameElement | null
      if (inner) {
        const innerDoc = inner.contentDocument
        if (!innerDoc || isBlankDoc(innerDoc) || !pageLooksReady(innerDoc)) return null
        return innerDoc
      }
      return pageLooksReady(doc) ? doc : null
    }

    const freezeFromDoc = (doc: Document | null): boolean => {
      if (cancelled || !doc?.documentElement || isBlankDoc(doc)) return false
      const html = freezeDocumentForVisualEditor(doc, editVariant)
      if (!visualHtmlLooksUsable(html)) return false
      freezeLockRef.current = true
      setEditSrcDoc(visualEditSrcDoc(html))
      return true
    }

    const tryFreeze = () => {
      if (cancelled || freezeLockRef.current) return true
      try {
        const target = shopDocFromPreview(iframe.contentDocument)
        if (!target) return false
        return freezeFromDoc(target)
      } catch {
        return false
      }
    }

    const applySavedFallback = () => {
      const fallback = savedHtmlForVariant(editVariant)
      if (!visualHtmlLooksUsable(fallback)) return false
      freezeLockRef.current = true
      setEditSrcDoc(visualEditSrcDoc(fallback))
      return true
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
        const target = shopDocFromPreview(iframe.contentDocument)
        if (target && freezeFromDoc(target)) return
      } catch {
        /* ignore */
      }
      applySavedFallback()
    }, 7000)

    if (iframe.contentDocument?.readyState === 'complete') onLoad()

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onLoad)
      window.clearInterval(poll)
      window.clearTimeout(failSafe)
    }
  }, [visualEditActive, useVisualHtml, htmlSource, project, liveTheme, editSrcDoc, freezeTick, previewPageKey, previewCategoryPath, previewProductId, previewCmsSlug, editVariant])

  useEffect(() => {
    if (!visualEditActive) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (leaveIntent) return
      requestLeave({ kind: 'exit' })
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [visualEditActive, leaveIntent, editDirty])

  const previewSrc = useMemo(() => {
    if (!hasWebsite) return null
    const v = encodeURIComponent(previewVersion || '0')
    const deviceQuery = visualEditorDeviceVariant(device)
    if (siteSlug?.trim()) {
      return appendVisualDeviceQuery(
        `${visualEditorPreviewPath(siteSlug.trim(), previewPageKey, previewCategoryPath, previewProductKey, previewCmsSlug)}?v=${v}`,
        deviceQuery
      )
    }
    if (!partnerId) return null
    return appendVisualDeviceQuery(
      `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`,
      deviceQuery
    )
  }, [partnerId, hasWebsite, previewVersion, siteSlug, previewPageKey, previewCategoryPath, previewProductKey, previewCmsSlug, device])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || visualEditActive || !siteSlug?.trim()) return
    const syncPage = () => {
      try {
        const path = iframe.contentWindow?.location.pathname || ''
        const slug = siteSlug.trim()
        const cms = cmsSlugFromSitePath(path, slug)
        if (cms) {
          if (previewCmsSlug !== cms || previewCategoryPath || previewProductId) {
            setPreviewCmsSlug(cms)
            setPreviewCategoryPath(null)
            setPreviewProductId(null)
            setPreviewProductKey(null)
          }
          return
        }
        const cat = categoryPathFromSitePath(path, slug)
        if (cat) {
          if (previewPageKey !== 'collection' || previewCategoryPath !== cat) {
            setPreviewPageKey('collection')
            setPreviewCategoryPath(cat)
            setPreviewProductId(null)
            setPreviewProductKey(null)
            setPreviewCmsSlug(null)
          }
          return
        }
        const productKey = productKeyFromSitePath(path, slug)
        if (productKey) {
          const productId = resolveVisualProductIdFromKey(productKey, productOptions)
          if (
            previewPageKey !== 'product_detail' ||
            previewProductKey !== productKey ||
            (productId && previewProductId !== productId)
          ) {
            setPreviewPageKey('product_detail')
            setPreviewProductKey(productKey)
            if (productId) setPreviewProductId(productId)
            setPreviewCategoryPath(null)
            setPreviewCmsSlug(null)
          }
          return
        }
        const key = pageKeyFromSitePath(path, slug)
        if (key && isVisualEditorPageKey(key) && key !== 'collection' && key !== 'product_detail') {
          if (key !== previewPageKey || previewCategoryPath || previewProductId || previewCmsSlug) {
            setPreviewPageKey(key)
            setPreviewCategoryPath(null)
            setPreviewProductId(null)
            setPreviewProductKey(null)
            setPreviewCmsSlug(null)
          }
        }
      } catch {
        /* cross-origin or srcdoc */
      }
    }
    iframe.addEventListener('load', syncPage)
    return () => iframe.removeEventListener('load', syncPage)
  }, [previewSrc, visualEditActive, siteSlug, previewPageKey, productOptions])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !liveTheme) return
    const apply = () => {
      applyThemeCssVarsToFrameWindow(iframe.contentWindow, liveTheme)
      try {
        iframe.contentWindow?.postMessage(
          { source: NANOAI_VE_MESSAGE, type: 'setTheme', vars: themeCssVarMap(liveTheme) },
          '*'
        )
      } catch {
        /* ignore */
      }
    }
    apply()
    const raf = window.requestAnimationFrame(apply)
    iframe.addEventListener('load', apply)
    return () => {
      window.cancelAnimationFrame(raf)
      iframe.removeEventListener('load', apply)
    }
  }, [liveTheme, previewSrc, editSrcDoc])

  const canVisualEdit = visualEditEnabled && Boolean(onVisualEditSave || onShopHomeSave)

  useEffect(() => {
    if (restoredVisualEditActiveRef.current) return
    if (!initialVisualEditStateRef.current?.active) return
    if (!canVisualEdit || quickEditDisabled || !hasWebsite || visualEditActive) return
    restoredVisualEditActiveRef.current = true
    const timer = window.setTimeout(() => startVisualEdit(), 0)
    return () => window.clearTimeout(timer)
  }, [canVisualEdit, quickEditDisabled, hasWebsite, visualEditActive])

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
    ? 'absolute inset-0 h-full w-full border-0'
    : embedded
      ? 'min-h-[calc(100dvh-11rem)] h-full flex-1'
      : device === 'desktop' || device === 'laptop'
        ? device === 'laptop'
          ? 'min-h-[calc(100dvh-12rem)] h-[min(78vh,900px)]'
          : 'min-h-[calc(100dvh-12rem)] h-[min(80vh,960px)]'
        : 'min-h-[640px] h-[min(78vh,860px)]'

  const editFrameWidth = frameWidth
  const deviceFrameIsFull = frameWidth === 'full'
  const lockComputerCanvas = device === 'desktop' || device === 'laptop'
  const computerCanvasStyle: CSSProperties = deviceFrameIsFull
    ? { width: '100%', minWidth: VISUAL_DESKTOP_MIN_PX, height: '100%' }
    : lockComputerCanvas && typeof editFrameWidth === 'number'
      ? { width: editFrameWidth, minWidth: editFrameWidth, height: '100%' }
      : { width: editFrameWidth as number, maxWidth: '100%', height: '100%' }
  const pageSelectValue = previewCmsSlug
    ? `cms:${previewCmsSlug}`
    : previewProductId
      ? `p:${previewProductId}`
      : previewCategoryPath
        ? `c:${previewCategoryPath}`
        : previewPageKey
  const catalogPageKeys = VISUAL_EDITOR_PAGE_KEYS.filter(
    (key) => key !== 'collection' && key !== 'product_detail'
  )

  function clearDynamicPreview() {
    setPreviewCategoryPath(null)
    setPreviewProductId(null)
    setPreviewProductKey(null)
    setPreviewCmsSlug(null)
  }

  function handlePageSelectChange(next: string) {
    if (next === pageSelectValue) return
    if (visualEditActive) {
      requestLeave({ kind: 'page', next })
      return
    }
    applyPageSelect(next)
  }

  const pageSelectOptions = (
    <>
      {catalogPageKeys.map((key) => (
        <option key={key} value={key}>
          {pageLabels[key]?.title ?? key}
        </option>
      ))}
      <optgroup label={t.visualEditCategoryGroup}>
        {categoryOptions.length ? (
          categoryOptions.map((cat) => (
            <option key={cat.path} value={`c:${cat.path}`}>
              {`${'· '.repeat(Math.max(0, cat.depth))}${cat.name}`}
            </option>
          ))
        ) : (
          <option value="" disabled>
            {t.visualEditCategoryEmpty}
          </option>
        )}
      </optgroup>
      <optgroup label={t.visualEditProductGroup}>
        {productOptions.length ? (
          productOptions.map((product) => (
            <option key={product.id} value={`p:${product.id}`}>
              {product.name}
            </option>
          ))
        ) : (
          <option value="" disabled>
            {t.visualEditProductEmpty}
          </option>
        )}
      </optgroup>
      <optgroup label={t.visualEditCmsGroup}>
        {cmsOptions.length ? (
          cmsOptions.map((page) => (
            <option key={page.slug} value={`cms:${page.slug}`}>
              {page.title}
            </option>
          ))
        ) : (
          <option value="" disabled>
            {t.visualEditCmsEmpty}
          </option>
        )}
      </optgroup>
    </>
  )

  const deviceButtons = (
    <>
      <Button
        type="button"
        size="sm"
        variant={device === 'mobile' ? 'default' : 'outline'}
        className="h-7 gap-1 px-1.5 text-[11px]"
        onClick={() => changeDevice('mobile')}
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden />
        {t.viewMobile}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={device === 'tablet' ? 'default' : 'outline'}
        className="h-7 gap-1 px-1.5 text-[11px]"
        onClick={() => changeDevice('tablet')}
      >
        <Tablet className="h-3.5 w-3.5" aria-hidden />
        {t.viewTablet}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={device === 'laptop' ? 'default' : 'outline'}
        className="h-7 gap-1 px-1.5 text-[11px]"
        onClick={() => changeDevice('laptop')}
      >
        <Laptop className="h-3.5 w-3.5" aria-hidden />
        {t.viewLaptop}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={device === 'desktop' ? 'default' : 'outline'}
        className="h-7 gap-1 px-1.5 text-[11px]"
        onClick={() => changeDevice('desktop')}
      >
        <Monitor className="h-3.5 w-3.5" aria-hidden />
        {t.viewDesktop}
      </Button>
    </>
  )

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
            {canVisualEdit ? (
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="sr-only sm:not-sr-only">{t.previewPageLabel}</span>
                <select
                  className="h-7 max-w-[22rem] rounded-md border bg-background px-1.5 text-[11px] text-foreground"
                  value={pageSelectValue}
                  disabled={quickEditDisabled}
                  onChange={(e) => handlePageSelectChange(e.target.value)}
                >
                  {pageSelectOptions}
                </select>
              </label>
            ) : null}
            {canVisualEdit ? (
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
            {deviceButtons}
          </div>
        </div>
      )}

      {visualEditActive ? null : canVisualEdit ? (
        <div>
          <PartnerWebsiteVisualEditorToolbar
            locale={locale}
            partnerId={partnerId}
            siteSlug={siteSlug}
            iframeRef={iframeRef}
            projectRef={projectRef}
            active={visualEditActive}
            documentKey={
              editSrcDoc
                ? `srcdoc-${editVariant}-${previewPageKey}-${previewCategoryPath || ''}-${previewProductId || ''}-${previewCmsSlug || ''}`
                : `live-${previewSrc}`
            }
            disabled={quickEditDisabled}
            websiteTitle={websiteTitle}
            theme={liveTheme}
            htmlPath={visualEditorTargetHtmlPath({
              pageKey: previewPageKey,
              variant: editVariant,
              categoryPath: previewCategoryPath,
              productId: previewProductId,
              cmsSlug: previewCmsSlug,
            })}
            viewHref={
              siteSlug?.trim()
                ? `${visualEditorPreviewPath(
                    siteSlug.trim(),
                    previewPageKey,
                    previewCategoryPath,
                    previewProductKey,
                    previewCmsSlug
                  )}?v=${encodeURIComponent(previewVersion || '0')}`
                : undefined
            }
            onSave={
              onVisualEditSave
                ? (nextProject) => {
                    const path = visualEditorTargetHtmlPath({
                      pageKey: previewPageKey,
                      variant: editVariant,
                      categoryPath: previewCategoryPath,
                      productId: previewProductId,
                      cmsSlug: previewCmsSlug,
                    })
                    const html = nextProject.files.find((f) => f.path === path && f.kind === 'html')?.content
                    if (html && visualHtmlLooksUsable(html)) {
                      flushedHtmlByVariantRef.current[editVariant] = html
                    }
                    return onVisualEditSave(nextProject, previewPageKey, editVariant, {
                      categoryPath: previewCategoryPath,
                      productId: previewProductId,
                      cmsSlug: previewCmsSlug,
                    })
                  }
                : undefined
            }
            onSaveShopHome={
              previewPageKey === 'home' &&
              editVariant === 'desktop' &&
              !previewCategoryPath &&
              !previewProductId &&
              !previewCmsSlug
                ? onShopHomeSave
                : undefined
            }
            onCancel={() => {
              flushedHtmlByVariantRef.current = {}
              setVisualEditActive(false)
              setEditDirty(false)
            }}
            onDirtyChange={setEditDirty}
            onError={(msg) => onVisualEditError?.(msg)}
            onAdminLogoChange={onAdminLogoChange}
            compact={false}
          />
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

      {canVisualEdit && !visualEditActive ? (
        <p className="text-[11px] text-muted-foreground">{t.visualEditDeviceHint}</p>
      ) : null}

      {visualEditActive ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 overflow-visible border-b bg-background px-2 py-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <label className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                <span className="sr-only sm:not-sr-only">{t.previewPageLabel}</span>
                <select
                  className="h-7 max-w-[22rem] rounded-md border bg-background px-1.5 text-[11px] text-foreground"
                  value={pageSelectValue}
                  disabled={quickEditDisabled}
                  onChange={(e) => handlePageSelectChange(e.target.value)}
                >
                  {pageSelectOptions}
                </select>
              </label>
              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {editVariant === 'mobile'
                  ? t.visualEditDeviceMobile
                  : editVariant === 'tablet'
                    ? t.visualEditDeviceTablet
                    : t.visualEditDeviceDesktop}
              </span>
              <div className="flex flex-wrap gap-1">{deviceButtons}</div>
              <div className="min-w-0 flex-1 basis-[min(100%,36rem)]">
            <PartnerWebsiteVisualEditorToolbar
              locale={locale}
              partnerId={partnerId}
              siteSlug={siteSlug}
              iframeRef={iframeRef}
              projectRef={projectRef}
              active={visualEditActive}
              documentKey={
                editSrcDoc
                  ? `srcdoc-${editVariant}-${previewPageKey}-${previewCategoryPath || ''}-${previewProductId || ''}-${previewCmsSlug || ''}`
                  : `live-${previewSrc}`
              }
              disabled={quickEditDisabled || !editSrcDoc}
              websiteTitle={websiteTitle}
              theme={liveTheme}
              htmlPath={visualEditorTargetHtmlPath({
                pageKey: previewPageKey,
                variant: editVariant,
                categoryPath: previewCategoryPath,
                productId: previewProductId,
                cmsSlug: previewCmsSlug,
              })}
              viewHref={
                siteSlug?.trim()
                  ? `${visualEditorPreviewPath(
                      siteSlug.trim(),
                      previewPageKey,
                      previewCategoryPath,
                      previewProductKey,
                      previewCmsSlug
                    )}?v=${encodeURIComponent(previewVersion || '0')}`
                  : undefined
              }
              onSave={
                onVisualEditSave
                  ? (nextProject) => {
                      const path = visualEditorTargetHtmlPath({
                        pageKey: previewPageKey,
                        variant: editVariant,
                        categoryPath: previewCategoryPath,
                        productId: previewProductId,
                        cmsSlug: previewCmsSlug,
                      })
                      const html = nextProject.files.find((f) => f.path === path && f.kind === 'html')?.content
                      if (html && visualHtmlLooksUsable(html)) {
                        flushedHtmlByVariantRef.current[editVariant] = html
                      }
                      return onVisualEditSave(nextProject, previewPageKey, editVariant, {
                        categoryPath: previewCategoryPath,
                        productId: previewProductId,
                        cmsSlug: previewCmsSlug,
                      })
                    }
                  : undefined
              }
              onSaveShopHome={
                previewPageKey === 'home' &&
                editVariant === 'desktop' &&
                !previewCategoryPath &&
                !previewProductId &&
                !previewCmsSlug
                  ? onShopHomeSave
                  : undefined
              }
              onCancel={() => requestLeave({ kind: 'exit' })}
              onDirtyChange={setEditDirty}
              onError={(msg) => onVisualEditError?.(msg)}
              onAdminLogoChange={onAdminLogoChange}
              onThemeLiveChange={liveTheme ? handleThemeLive : undefined}
              themeSaving={themeSaving}
              saveFnRef={saveFnRef}
              onRequestLeave={(kind) => requestLeave({ kind })}
              compact
            />
              </div>
            </div>
            {!editSrcDoc ? (
              <p className="text-[11px] text-muted-foreground">{t.visualEditPreparing}</p>
            ) : null}
          </div>
          <div
            className={cn(
              'relative min-h-0 min-w-0 flex-1 bg-muted/30',
              lockComputerCanvas ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'
            )}
          >
            <div
              className={cn(
                'relative mx-auto h-full bg-white',
                lockComputerCanvas ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden',
                deviceFrameIsFull ? 'w-full' : 'border-x shadow-sm'
              )}
              style={computerCanvasStyle}
            >
              <iframe
                key={editSrcDoc ? `ve-srcdoc-${editVariant}-${previewPageKey}` : previewSrc}
                ref={iframeRef}
                title={t.previewTitle}
                {...(editSrcDoc ? { srcDoc: editSrcDoc } : { src: previewSrc })}
                className="absolute inset-0 h-full w-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
              />
              {!editSrcDoc ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-muted-foreground">
                  {t.visualEditPreparing}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
      <div
        className={cn(
          'overflow-auto rounded-lg border bg-muted/20 p-1',
          embedded && 'flex min-h-0 flex-1 flex-col'
        )}
      >
        <div
          className={cn(
            'relative mx-auto flex min-h-0 flex-col rounded-md border bg-white shadow-sm transition-[width] duration-200',
            lockComputerCanvas ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden',
            deviceFrameIsFull ? 'h-full w-full flex-1' : ''
          )}
          style={
            deviceFrameIsFull
              ? { minWidth: VISUAL_DESKTOP_MIN_PX }
              : lockComputerCanvas && typeof editFrameWidth === 'number'
                ? { width: editFrameWidth, minWidth: editFrameWidth }
                : { width: editFrameWidth as number, maxWidth: '100%' }
          }
        >
          <iframe
            key={editSrcDoc ? `ve-srcdoc-${editVariant}-${previewPageKey}` : previewSrc}
            ref={iframeRef}
            title={t.previewTitle}
            {...(editSrcDoc ? { srcDoc: editSrcDoc } : { src: previewSrc })}
            className={cn('block w-full border-0 bg-white', iframeClass)}
            style={
              visualEditActive
                ? { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#fff' }
                : undefined
            }
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
          />
          {visualEditActive && !editSrcDoc ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-muted-foreground">
              {t.visualEditPreparing}
            </div>
          ) : null}
        </div>
      </div>
      )}

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

      <AlertDialog
        open={Boolean(leaveIntent)}
        onOpenChange={(open) => {
          if (!open && !leaveBusy) void resolveLeave('stay')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.visualEditLeaveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.visualEditLeaveBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" disabled={leaveBusy} onClick={() => void resolveLeave('stay')}>
              {t.visualEditLeaveStay}
            </Button>
            <Button type="button" variant="outline" disabled={leaveBusy} onClick={() => void resolveLeave('discard')}>
              {t.visualEditLeaveDiscard}
            </Button>
            <Button type="button" disabled={leaveBusy} onClick={() => void resolveLeave('save')}>
              {t.visualEditLeaveSave}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
