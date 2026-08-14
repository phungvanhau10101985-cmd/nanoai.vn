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
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
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
  onVisualEditSave?: (
    project: PartnerWebsiteProject,
    pageKey: PartnerWebsitePageKey,
    device: VisualDeviceVariant,
    extras?: { categoryPath?: string | null; productId?: string | null; cmsSlug?: string | null }
  ) => Promise<void>
  onShopHomeSave?: (patch: FashionHomeCopyPatch) => Promise<void>
  onVisualEditError?: (message: string) => void
  onLiveThemeChange?: (theme: PartnerWebsiteTheme) => void
  onThemePersisted?: (theme: PartnerWebsiteTheme) => void
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
  const [device, setDevice] = useState<PartnerWebsitePreviewDevice>('desktop')
  const [previewPageKey, setPreviewPageKey] = useState<PartnerWebsitePageKey>('home')
  const [previewCategoryPath, setPreviewCategoryPath] = useState<string | null>(null)
  const [previewProductId, setPreviewProductId] = useState<string | null>(null)
  const [previewProductKey, setPreviewProductKey] = useState<string | null>(null)
  const [previewCmsSlug, setPreviewCmsSlug] = useState<string | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<Array<{ path: string; name: string; depth: number }>>(
    []
  )
  const [productOptions, setProductOptions] = useState<Array<{ id: string; name: string; key: string }>>([])
  const [cmsOptions, setCmsOptions] = useState<Array<{ slug: string; title: string }>>([])
  const [visualEditActive, setVisualEditActive] = useState(false)
  const [editSrcDoc, setEditSrcDoc] = useState<string | null>(null)
  const [editDirty, setEditDirty] = useState(false)
  const [freezeTick, setFreezeTick] = useState(0)
  const [portalReady, setPortalReady] = useState(false)
  const editVariant = visualEditorDeviceVariant(device)
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

  function savedHtmlForVariant(variant: VisualDeviceVariant): string {
    if (previewProductId) {
      const exact = resolveExactVisualProductHtml(
        { htmlSource, project, theme: liveTheme },
        previewProductId,
        variant
      )
      if (visualHtmlLooksUsable(exact)) return isolateVisualHtmlForDevice(exact, variant)
      if (variant === 'mobile') {
        const desktop = resolveExactVisualProductHtml(
          { htmlSource, project, theme: liveTheme },
          previewProductId,
          'desktop'
        )
        return isolateVisualHtmlForDevice(desktop, 'mobile', { stripAddedChrome: true })
      }
      return ''
    }
    if (previewCmsSlug) {
      const exact = resolveExactVisualCmsHtml(
        { htmlSource, project, theme: liveTheme },
        previewCmsSlug,
        variant
      )
      if (visualHtmlLooksUsable(exact)) return isolateVisualHtmlForDevice(exact, variant)
      if (variant === 'mobile') {
        const desktop = resolveExactVisualCmsHtml(
          { htmlSource, project, theme: liveTheme },
          previewCmsSlug,
          'desktop'
        )
        return isolateVisualHtmlForDevice(desktop, 'mobile', { stripAddedChrome: true })
      }
      return ''
    }
    if (previewCategoryPath) {
      const exact = resolveExactVisualCategoryHtml(
        { htmlSource, project, theme: liveTheme },
        previewCategoryPath,
        variant
      )
      if (visualHtmlLooksUsable(exact)) return isolateVisualHtmlForDevice(exact, variant)
      if (variant === 'mobile') {
        const desktop = resolveExactVisualCategoryHtml(
          { htmlSource, project, theme: liveTheme },
          previewCategoryPath,
          'desktop'
        )
        return isolateVisualHtmlForDevice(desktop, 'mobile', { stripAddedChrome: true })
      }
      return ''
    }
    const exact = resolveExactVisualPageHtml(
      { htmlSource, project, theme: liveTheme },
      previewPageKey,
      variant
    )
    if (visualHtmlLooksUsable(exact)) return isolateVisualHtmlForDevice(exact, variant)
    if (variant === 'mobile') {
      const desktop = resolveExactVisualPageHtml(
        { htmlSource, project, theme: liveTheme },
        previewPageKey,
        'desktop'
      )
      if (visualHtmlLooksUsable(desktop)) {
        return isolateVisualHtmlForDevice(desktop, 'mobile', { stripAddedChrome: true })
      }
      if (previewPageKey === 'home' && useVisualHtml) {
        const home = resolveSavedVisualEditorHtml({ htmlSource, project })
        return isolateVisualHtmlForDevice(home, 'mobile', { stripAddedChrome: true })
      }
    }
    if (previewPageKey !== 'home') {
      return resolveSavedVisualPageHtml({
        pageKey: previewPageKey,
        variant,
        htmlSource,
        project,
        theme: liveTheme,
      })
    }
    return ''
  }

  function startVisualEdit() {
    if (!visualEditEnabled || quickEditDisabled || !hasWebsite) return
    if (!onVisualEditSave && !onShopHomeSave) return
    freezeLockRef.current = false
    setEditSrcDoc(null)
    setEditDirty(false)
    setVisualEditActive(true)
  }

  function changeDevice(next: PartnerWebsitePreviewDevice) {
    if (
      visualEditActive &&
      visualEditorDeviceVariant(next) !== visualEditorDeviceVariant(device)
    ) {
      if (editDirty && !window.confirm(t.visualEditSwitchDeviceConfirm)) return
      freezeLockRef.current = false
      setEditSrcDoc(null)
      setEditDirty(false)
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
      setEditSrcDoc(saved)
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
      setEditSrcDoc(html)
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
      setEditSrcDoc(fallback)
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
  }, [visualEditActive, useVisualHtml, htmlSource, project, editSrcDoc, freezeTick, previewPageKey, previewCategoryPath, previewProductId, previewCmsSlug, liveTheme, editVariant])

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
    if (siteSlug?.trim()) {
      return `${visualEditorPreviewPath(siteSlug.trim(), previewPageKey, previewCategoryPath, previewProductKey, previewCmsSlug)}?v=${v}`
    }
    if (!partnerId) return null
    return `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview?v=${v}`
  }, [partnerId, hasWebsite, previewVersion, siteSlug, previewPageKey, previewCategoryPath, previewProductKey, previewCmsSlug])

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
    ? 'absolute inset-0 h-full w-full border-0'
    : embedded
      ? 'min-h-[calc(100dvh-11rem)] h-full flex-1'
      : device === 'desktop' || device === 'laptop'
        ? device === 'laptop'
          ? 'min-h-[calc(100dvh-12rem)] h-[min(78vh,900px)]'
          : 'min-h-[calc(100dvh-12rem)] h-[min(80vh,960px)]'
        : 'min-h-[640px] h-[min(78vh,860px)]'

  const canVisualEdit = visualEditEnabled && Boolean(onVisualEditSave || onShopHomeSave)
  const editFrameWidth = frameWidth
  const deviceFrameIsFull = frameWidth === 'full'
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

      {canVisualEdit ? (
        <div className={cn(visualEditActive && 'shrink-0 space-y-1 px-1.5 pt-1')}>
          {visualEditActive ? (
            <div className="flex flex-wrap items-center gap-1">
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="sr-only sm:not-sr-only">{t.previewPageLabel}</span>
                <select
                  className="h-7 max-w-[22rem] rounded-md border bg-background px-1.5 text-[11px] text-foreground"
                  value={pageSelectValue}
                  disabled
                >
                  {pageSelectOptions}
                </select>
              </label>
              {deviceButtons}
              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {editVariant === 'mobile' ? t.visualEditDeviceMobile : t.visualEditDeviceDesktop}
              </span>
            </div>
          ) : null}
          <PartnerWebsiteVisualEditorToolbar
            locale={locale}
            partnerId={partnerId}
            siteSlug={siteSlug}
            iframeRef={iframeRef}
            projectRef={projectRef}
            active={visualEditActive}
            documentKey={editSrcDoc ? `srcdoc-${editVariant}` : `live-${previewSrc}`}
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
                ? visualEditorPreviewPath(
                    siteSlug.trim(),
                    previewPageKey,
                    previewCategoryPath,
                    previewProductKey,
                    previewCmsSlug
                  )
                : undefined
            }
            onSave={
              onVisualEditSave
                ? (project) =>
                    onVisualEditSave(project, previewPageKey, editVariant, {
                      categoryPath: previewCategoryPath,
                      productId: previewProductId,
                      cmsSlug: previewCmsSlug,
                    })
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
              setVisualEditActive(false)
              setEditDirty(false)
            }}
            onDirtyChange={setEditDirty}
            onError={(msg) => onVisualEditError?.(msg)}
            onAdminLogoChange={onAdminLogoChange}
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

      {canVisualEdit && !visualEditActive ? (
        <p className="text-[11px] text-muted-foreground">{t.visualEditDeviceHint}</p>
      ) : null}

      <div
        className={cn(
          'overflow-auto rounded-lg border bg-muted/20 p-1',
          (embedded || visualEditActive) && 'flex min-h-0 flex-1 flex-col',
          visualEditActive && 'relative min-h-0 overflow-hidden rounded-none border-0 bg-white p-0'
        )}
        style={visualEditActive ? { flex: '1 1 0%', minHeight: 0, position: 'relative' } : undefined}
      >
        <div
          className={cn(
            'relative mx-auto flex min-h-0 flex-col overflow-hidden rounded-md border bg-white shadow-sm transition-[width] duration-200',
            deviceFrameIsFull ? 'h-full w-full flex-1' : '',
            visualEditActive && 'rounded-none border-0 shadow-none'
          )}
          style={
            visualEditActive
              ? {
                  position: 'absolute',
                  inset: 0,
                  width: deviceFrameIsFull ? '100%' : editFrameWidth,
                  maxWidth: '100%',
                  height: '100%',
                }
              : deviceFrameIsFull
                ? undefined
                : { width: editFrameWidth, maxWidth: '100%' }
          }
        >
          <iframe
            key={editSrcDoc ? 've-srcdoc' : previewSrc}
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
