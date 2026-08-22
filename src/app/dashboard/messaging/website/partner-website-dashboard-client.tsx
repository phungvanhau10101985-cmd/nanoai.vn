'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { PartnerWebsiteRow, PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'
import {
  scrollToPartnerWebsiteAdminSection,
  type PartnerWebsiteAdminSectionId,
} from '@/lib/partner-website/partner-website-admin-nav'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerWebsiteCreationJournalPanel } from '@/components/partner-website/partner-website-creation-journal-panel'
import type { PartnerWebsiteCreationJournal } from '@/lib/partner-website/partner-website-creation-journal'
import { isHomePageBuilt } from '@/lib/partner-website/partner-website-creation-journal'
import { PartnerWebsiteDevicePreview, type PartnerWebsiteDevicePreviewHandle } from '@/components/partner-website/partner-website-device-preview'
import { PartnerWebsiteLeadsPanel } from '@/components/partner-website/partner-website-leads-panel'
import { PartnerWebsiteCapabilitiesPanel } from '@/components/partner-website/partner-website-capabilities-panel'
import { PartnerWebsiteCategoriesPanel } from '@/components/partner-website/partner-website-categories-panel'
import { PartnerWebsiteReviewsQaPanel } from '@/components/partner-website/partner-website-reviews-qa-panel'
import { PartnerWebsitePromotionsPanel } from '@/components/partner-website/partner-website-promotions-panel'
import { PartnerWebsiteCustomersPanel } from '@/components/partner-website/partner-website-customers-panel'
import { PartnerWebsiteStaticPagesPanel } from '@/components/partner-website/partner-website-static-pages-panel'
import { PartnerWebsiteLandingsPanel } from '@/components/partner-website/partner-website-landings-panel'
import { PartnerWebsiteFloatingCtaPanel } from '@/components/partner-website/partner-website-floating-cta-panel'
import { PartnerWebsiteRevisionMenu } from '@/components/partner-website/partner-website-revision-menu'
import { PartnerWebsiteResetDialog } from '@/components/partner-website/partner-website-reset-dialog'
import { PartnerCustomDomainSettingsCard } from '@/app/dashboard/messaging/partner-custom-domain-settings-card'
import {
  getPartnerWebsiteResetTrashStatus,
  restorePartnerWebsiteFromResetTrash,
} from '@/app/dashboard/messaging/website/partner-website-reset-actions'
import type { PartnerWebsiteResetTrashInfo } from '@/lib/db/partner-website-reset-pg'
import {
  PartnerWebsiteTenantAdminBar,
  type PartnerWebsiteTenantSection,
} from '@/components/partner-website/partner-website-tenant-admin-bar'
import { ExternalLink, Globe, Loader2, PanelLeftOpen, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  appendVisualDeviceQuery,
  visualEditorTargetHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { normalizePartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  applyFirstImageLogoToHtml,
  applyFirstImageLogoToProject,
} from '@/lib/partner-website/visual-editor/apply-first-image-logo'

type NavLabels = {
  inbox: string
  orders: string
  marketing: string
  settings: string
  website: string
}

type WebsiteDashboardPartner = {
  id: string
  slug: string
  brand_name: string | null
  display_name: string | null
  logo_url?: string | null
  industry_key?: 'fashion' | 'hotel' | 'food' | 'other' | null
}

type Props = {
  locale: WebLocale
  partners: WebsiteDashboardPartner[]
  hadPartnersWithoutWebsitePerm?: boolean
  initialWebsites: Record<string, PartnerWebsiteRow | null>
  initialPartnerId: string
  navLabels: NavLabels
  hidePartnerPicker?: boolean
  lockedPartnerSlug?: string
  /** When set, only this admin section is shown (in-page embed on settings). */
  embeddedSectionId?: PartnerWebsiteAdminSectionId
}

export function PartnerWebsiteDashboardClient({
  locale,
  partners,
  hadPartnersWithoutWebsitePerm = false,
  initialWebsites,
  initialPartnerId,
  navLabels,
  hidePartnerPicker = false,
  lockedPartnerSlug,
  embeddedSectionId,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const pm = getDictionary(locale).partnerMessaging
  const { toast } = useToast()
  const router = useRouter()

  const [partnerId, setPartnerId] = useState(initialPartnerId || partners[0]?.id || '')
  const initialPartner = partners.find((p) => p.id === (initialPartnerId || partners[0]?.id)) ?? null
  const initialWebsiteRow =
    initialWebsites[initialPartnerId] ?? initialWebsites[partners[0]?.id ?? ''] ?? null
  const [website, setWebsite] = useState<PartnerWebsiteRow | null>(initialWebsiteRow)
  const [liveTheme, setLiveTheme] = useState(initialWebsiteRow?.theme ?? null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(
    initialWebsiteRow?.logoUrl ?? initialPartner?.logo_url?.trim() ?? ''
  )
  const [publishing, setPublishing] = useState(false)
  const [activeSection, setActiveSection] = useState<PartnerWebsiteTenantSection>('editor')
  const [autoStartLandingChat, setAutoStartLandingChat] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(
    initialWebsiteRow?.updatedAt ?? String(Date.now())
  )
  const [chatBusy, setChatBusy] = useState(false)
  const previewRef = useRef<PartnerWebsiteDevicePreviewHandle>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [, setCreationJournal] = useState<PartnerWebsiteCreationJournal | null>(
    initialWebsiteRow?.creationJournal ?? null
  )
  const [journalResetKey, setJournalResetKey] = useState(0)
  const [resetTrash, setResetTrash] = useState<PartnerWebsiteResetTrashInfo | null>(null)
  const [restoringTrash, setRestoringTrash] = useState(false)
  const [setupCollapsed, setSetupCollapsed] = useState(false)

  const partner = useMemo(() => partners.find((p) => p.id === partnerId) ?? null, [partners, partnerId])
  const partnerTitle =
    website?.title?.trim() || partner?.brand_name || partner?.display_name || 'Website'

  const loadWebsite = useCallback(
    async (pid: string) => {
      setProvisioning(true)
      try {
        const res = await fetch(
          `/api/messaging/partner-website/${encodeURIComponent(pid)}?locale=${encodeURIComponent(locale)}`
        )
        const json = (await res.json().catch(() => ({}))) as {
          website?: PartnerWebsiteRow | null
          publicUrl?: string | null
          autoProvisioned?: boolean
          error?: string
        }
        if (!res.ok) {
          toast({ title: json.error || t.errorGeneric, variant: 'destructive' })
          return
        }
        setWebsite(json.website ?? null)
        setPublicUrl(json.publicUrl ?? null)
        if (json.website) {
          setLogoUrl(json.website.logoUrl ?? '')
          setCreationJournal(json.website.creationJournal)
          setPreviewVersion(json.website.updatedAt || String(Date.now()))
          setLiveTheme(json.website.theme)
          if (json.autoProvisioned) {
            toast({
              title: t.autoProvisionTitle,
              description: t.autoProvisionHint,
            })
          }
        }
      } finally {
        setProvisioning(false)
      }
    },
    [locale, t.errorGeneric, toast]
  )

  useEffect(() => {
    if (!partnerId) return
    void loadWebsite(partnerId)
    // Only refetch when the workspace changes — not when parent re-renders (section click).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadWebsite identity is unstable (toast)
  }, [partnerId])

  function onPartnerChange(nextId: string) {
    setPartnerId(nextId)
    const cached = initialWebsites[nextId]
    const nextPartner = partners.find((p) => p.id === nextId)
    if (cached) {
      setWebsite(cached)
      setLogoUrl(cached.logoUrl ?? nextPartner?.logo_url?.trim() ?? '')
      setPreviewVersion(cached.updatedAt || String(Date.now()))
      setLiveTheme(cached.theme)
    } else {
      setWebsite(null)
      setLogoUrl(nextPartner?.logo_url?.trim() ?? '')
      setPreviewVersion(String(Date.now()))
      setLiveTheme(null)
    }
    void loadWebsite(nextId)
    if (embeddedSectionId) return
    const slug = nextPartner?.slug ?? lockedPartnerSlug
    if (slug) {
      router.replace(partnerWebsiteDashboardPath(slug))
      return
    }
    router.replace(`/dashboard/messaging/website?partner=${encodeURIComponent(nextId)}`)
  }

  async function handleMigrateLegacy() {
    if (!partnerId || !website || website.renderMode !== 'legacy') return
    setMigrating(true)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/migrate-template?locale=${encodeURIComponent(locale)}`,
        { method: 'POST' }
      )
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        publicUrl?: string | null
        migrated?: boolean
        reason?: string
        error?: string
      }
      if (!res.ok || !json.website) {
        toast({ title: json.error || t.errorGeneric, variant: 'destructive' })
        return
      }
      setWebsite(json.website)
      setPublicUrl(json.publicUrl ?? null)
      setPreviewVersion(json.website.updatedAt || String(Date.now()))
      toast({
        title: json.migrated ? t.legacyMigrateSuccess : t.legacyMigrateAlready,
      })
      router.refresh()
    } finally {
      setMigrating(false)
    }
  }

  function handleWebsiteUpdated(payload: {
    website: PartnerWebsiteRow
    publicUrl: string | null
    assistantMessage: string
    source?: string
  }) {
    setWebsite(payload.website)
    setPublicUrl(payload.publicUrl)
    setCreationJournal(payload.website.creationJournal)
    setLogoUrl(payload.website.logoUrl ?? '')
    setLiveTheme(payload.website.theme)
    setPreviewVersion(payload.website.updatedAt || String(Date.now()))
    toast({
      title: payload.source === 'fallback' ? t.fallbackGenerated : t.generateSuccess,
      description: payload.assistantMessage,
      variant: payload.source === 'fallback' ? 'destructive' : 'default',
    })
    router.refresh()
  }

  function handleWebsiteRestored(payload: { website: PartnerWebsiteRow; publicUrl: string | null }) {
    setWebsite(payload.website)
    setPublicUrl(payload.publicUrl)
    setLogoUrl(payload.website.logoUrl ?? '')
    setLiveTheme(payload.website.theme)
    setPreviewVersion(payload.website.updatedAt || String(Date.now()))
    toast({ title: t.restoreSuccess })
    router.refresh()
  }

  const loadResetTrash = useCallback(async (pid: string) => {
    if (!pid) {
      setResetTrash(null)
      return
    }
    const res = await getPartnerWebsiteResetTrashStatus(pid)
    if ('error' in res) {
      setResetTrash(null)
      return
    }
    setResetTrash(res.trash)
  }, [])

  useEffect(() => {
    if (partnerId) void loadResetTrash(partnerId)
    else setResetTrash(null)
  }, [partnerId, loadResetTrash, website])

  function handleWebsiteResetComplete() {
    setWebsite(null)
    setPublicUrl(null)
    setCreationJournal(null)
    setLogoUrl(partner?.logo_url?.trim() ?? '')
    setPreviewVersion(String(Date.now()))
    setLiveTheme(null)
    setJournalResetKey((k) => k + 1)
    toast({ title: t.resetWebsiteSuccess })
    void loadWebsite(partnerId)
    void loadResetTrash(partnerId)
    router.refresh()
  }

  async function handleRestoreResetTrash() {
    if (!partnerId || restoringTrash) return
    setRestoringTrash(true)
    try {
      const res = await restorePartnerWebsiteFromResetTrash(partnerId)
      if ('error' in res) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setWebsite(res.website)
      setPublicUrl(res.publicUrl)
      setCreationJournal(res.website.creationJournal)
      setLogoUrl(res.website.logoUrl ?? '')
      setPreviewVersion(res.website.updatedAt || String(Date.now()))
      setJournalResetKey((k) => k + 1)
      setResetTrash(null)
      toast({ title: t.restoreResetTrashSuccess })
      router.refresh()
    } finally {
      setRestoringTrash(false)
    }
  }

  async function handlePublish(publish: boolean) {
    if (!partnerId || !website) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: publish ? 'publish' : 'unpublish' }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        publicUrl?: string | null
        error?: string
      }
      if (!res.ok || !json.website) {
        toast({ title: json.error || t.errorGeneric, variant: 'destructive' })
        return
      }
      setWebsite(json.website)
      setPublicUrl(json.publicUrl ?? null)
      setPreviewVersion(json.website.updatedAt || String(Date.now()))
      toast({ title: publish ? t.publishSuccess : t.unpublishSuccess })
      router.refresh()
    } finally {
      setPublishing(false)
    }
  }

  function handleWebsiteRefresh(nextWebsite: PartnerWebsiteRow) {
    setWebsite(nextWebsite)
    setCreationJournal(nextWebsite.creationJournal)
    setLogoUrl(nextWebsite.logoUrl ?? '')
    setLiveTheme(nextWebsite.theme)
    setPreviewVersion(nextWebsite.updatedAt || String(Date.now()))
  }

  const websiteForEditor =
    website && liveTheme ? { ...website, theme: liveTheme } : website

  const homeBuilt = website ? isHomePageBuilt(website.creationJournals) : false
  const canOpenLanding = Boolean(website && homeBuilt)
  const isEmbedded = Boolean(embeddedSectionId)
  const sectionWrapClass = (sectionId: PartnerWebsiteAdminSectionId) =>
    isEmbedded && embeddedSectionId !== sectionId ? 'hidden' : undefined

  const previewPath = website ? partnerWebsitePublicPath(website.siteSlug) : null

  const handleVisualEditSave = useCallback(
    async (
      project: PartnerWebsiteProject,
      pageKey = 'home',
      device: VisualDeviceVariant = 'desktop',
      extras?: { categoryPath?: string | null; productId?: string | null; cmsSlug?: string | null }
    ) => {
      if (!partnerId || !website) {
        throw new Error(t.visualEditSaveFailed)
      }
      const key = normalizePartnerWebsitePageKey(pageKey)
      const categoryPath = extras?.categoryPath || null
      const productId = extras?.productId || null
      const cmsSlug = extras?.cmsSlug || null
      const htmlPath = visualEditorTargetHtmlPath({
        pageKey: key,
        variant: device,
        categoryPath,
        productId,
        cmsSlug,
      })
      const html =
        project.files.find((f) => f.path === htmlPath && f.kind === 'html')?.content ||
        (key === 'home' && device === 'desktop' && !categoryPath && !productId && !cmsSlug
          ? project.files.find((f) => f.path === 'index.html' && f.kind === 'html')?.content
          : undefined) ||
        ''
      let res: Response
      try {
        res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlSource: html,
            visualEdited: true,
            visualPageKey: key,
            visualDevice: device,
            visualCategoryPath: categoryPath || undefined,
            visualProductId: productId || undefined,
            visualCmsSlug: cmsSlug || undefined,
          }),
        })
      } catch {
        throw new Error(t.visualEditSaveFailed)
      }
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        error?: string
      }
      if (!res.ok || !json.website) {
        throw new Error(json.error || t.visualEditSaveFailed)
      }
      setWebsite(json.website)
      setLiveTheme(json.website.theme)
      setPreviewVersion(json.website.updatedAt || String(Date.now()))
      toast({ title: t.visualEditSaveSuccess })
    },
    [partnerId, website, t.visualEditSaveFailed, t.visualEditSaveSuccess, toast]
  )

  const scrollToSection = useCallback((section: PartnerWebsiteTenantSection) => {
    setActiveSection(section)
    const id =
      section === 'editor'
        ? 'partner-website-editor'
        : section === 'landings'
          ? 'partner-website-landings'
          : 'partner-website-leads'
    scrollToPartnerWebsiteAdminSection(id)
  }, [])

  useEffect(() => {
    if (isEmbedded) return
    const hash = window.location.hash.replace(/^#/, '').trim()
    if (!hash) return
    const timer = window.setTimeout(() => {
      scrollToPartnerWebsiteAdminSection(hash)
      if (hash === 'partner-website-editor') setActiveSection('editor')
      else if (hash === 'partner-website-landings') setActiveSection('landings')
      else if (hash === 'partner-website-leads') setActiveSection('leads')
    }, provisioning ? 400 : 80)
    return () => window.clearTimeout(timer)
  }, [isEmbedded, provisioning, website?.id])

  return (
    <div
      className={
        isEmbedded
          ? 'flex w-full min-h-0 flex-1 flex-col gap-2'
          : 'mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-3 px-0 md:px-1'
      }
    >
      {partners.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {hadPartnersWithoutWebsitePerm ? t.noWebsitePermTitle : t.noPartnerTitle}
            </CardTitle>
            <CardDescription>
              {hadPartnersWithoutWebsitePerm ? t.noWebsitePermBody : t.pageDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={hadPartnersWithoutWebsitePerm ? '/dashboard/messaging/settings' : '/dashboard/messaging'}>
                {hadPartnersWithoutWebsitePerm ? navLabels.settings : t.createChannelLink}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {!hidePartnerPicker && !isEmbedded ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.selectPartner}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {partners.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={p.id === partnerId ? 'default' : 'outline'}
                    onClick={() => onPartnerChange(p.id)}
                  >
                    {p.brand_name || p.display_name || p.slug}
                    <span className="ml-1 font-normal opacity-80">
                      (
                      {(p.industry_key || 'fashion') === 'hotel'
                        ? t.industryLabelHotel
                        : (p.industry_key || 'fashion') === 'food'
                          ? t.industryLabelFood
                          : (p.industry_key || 'fashion') === 'other'
                            ? t.industryLabelOther
                            : t.industryLabelFashion}
                      )
                    </span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {resetTrash && !website && (!isEmbedded || !sectionWrapClass('partner-website-editor')) ? (
            <div className="space-y-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs text-muted-foreground">
                {t.restoreResetTrashHint.replace('{days}', String(resetTrash.daysLeft || 1))}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={restoringTrash || !partnerId}
                onClick={() => void handleRestoreResetTrash()}
              >
                {restoringTrash ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {restoringTrash ? t.restoreResetTrashBusy : t.restoreResetTrashButton}
              </Button>
            </div>
          ) : null}

          {website?.renderMode === 'legacy' ? (
            <div className={sectionWrapClass('partner-website-editor')}>
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t.legacyMigrateTitle}</CardTitle>
                <CardDescription className="text-xs">{t.legacyMigrateHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  size="sm"
                  disabled={migrating || chatBusy}
                  onClick={() => void handleMigrateLegacy()}
                >
                  {migrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {migrating ? t.legacyMigrating : t.legacyMigrateButton}
                </Button>
              </CardContent>
            </Card>
            </div>
          ) : null}

          {!isEmbedded && website && homeBuilt ? (
                <PartnerWebsiteTenantAdminBar
                  partnerTitle={partnerTitle}
                  siteSlug={website?.siteSlug}
                  isPublished={Boolean(website?.isPublished)}
                  publishedLabel={t.publishedBadge}
                  draftLabel={t.draftBadge}
                  publicUrl={publicUrl}
                  sections={{
                    editor: t.tenantNavEditor,
                    landings: t.tenantNavLandings,
                    leads: t.tenantNavLeads,
                    publicSite: t.tenantNavPublicSite,
                  }}
                  activeSection={activeSection}
                  onSectionSelect={scrollToSection}
                />
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div
              id="partner-website-editor"
              className={cn(
                'grid min-h-0 flex-1 scroll-mt-24 gap-3 lg:items-start',
                setupCollapsed
                  ? 'lg:grid-cols-1'
                  : isEmbedded
                    ? 'lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]'
                    : 'lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]',
                sectionWrapClass('partner-website-editor')
              )}
            >
              <div className={cn('min-h-0 min-w-0', setupCollapsed && 'hidden')}>
              <PartnerWebsiteCreationJournalPanel
                key={`${partnerId}-${journalResetKey}`}
                locale={locale}
                t={t}
                partnerId={partnerId}
                partnerTitle={partnerTitle}
                defaultBrandName={partner?.brand_name || partner?.display_name || ''}
                industryKey={partner?.industry_key ?? 'fashion'}
                partnerSlug={partner?.slug}
                website={websiteForEditor}
                logoUrl={logoUrl}
                onLogoUrlChange={setLogoUrl}
                disabled={!partnerId}
                onBusyChange={setChatBusy}
                onError={(message) => toast({ title: message, variant: 'destructive' })}
                onWebsiteUpdated={handleWebsiteUpdated}
                onWebsiteRefresh={handleWebsiteRefresh}
                onJournalChange={setCreationJournal}
                onCollapse={() => setSetupCollapsed(true)}
                onLiveThemeChange={setLiveTheme}
                onThemePersisted={(theme, extras) => {
                  setLiveTheme(theme)
                  setWebsite((prev) =>
                    prev
                      ? {
                          ...prev,
                          theme,
                          ...(extras?.htmlSource !== undefined ? { htmlSource: extras.htmlSource } : {}),
                          ...(extras?.project ? { project: extras.project as PartnerWebsiteProject } : {}),
                        }
                      : prev
                  )
                  setPreviewVersion(String(Date.now()))
                }}
                domainSlot={
                  partnerId && partner?.slug ? (
                    <PartnerCustomDomainSettingsCard
                      key={partnerId}
                      variant="website"
                      partnerId={partnerId}
                      partnerSlug={partner.slug}
                      siteSlug={website?.siteSlug ?? null}
                      sitePublished={Boolean(website?.isPublished)}
                      t={pm}
                      saveOkMessage={pm.saveOk}
                      onDomainChanged={() => void loadWebsite(partnerId)}
                    />
                  ) : null
                }
              />
              </div>

              <Card
                id="partner-website-device-preview"
                className="flex min-h-[36rem] min-w-0 w-full flex-col lg:sticky lg:z-10"
                style={{
                  top: 'calc(var(--site-header-height, 3.5rem) + 4.25rem)',
                }}
              >
              <CardHeader className="shrink-0 space-y-2 px-3 pb-2 pt-3 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {setupCollapsed ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2"
                        onClick={() => setSetupCollapsed(false)}
                      >
                        <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
                        <span className="hidden sm:inline">{t.setupPanelExpand}</span>
                      </Button>
                    ) : null}
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4 shrink-0" />
                      {t.previewTitle}
                    </CardTitle>
                  </div>
                </div>

                {website ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!website}
                      asChild={Boolean(website && partnerId)}
                    >
                      {website && partnerId ? (
                        <a
                          href={appendVisualDeviceQuery(
                            publicUrl ||
                              (website.siteSlug
                                ? `/site/${encodeURIComponent(website.siteSlug)}`
                                : `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview`),
                            'desktop'
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t.previewButton}
                        </a>
                      ) : (
                        <span>{t.previewButton}</span>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={publishing || website.isPublished}
                      onClick={() => void handlePublish(true)}
                    >
                      {publishing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      {t.publishButton}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={publishing || !website.isPublished}
                      onClick={() => void handlePublish(false)}
                    >
                      {t.unpublishButton}
                    </Button>
                    {partner?.slug ? (
                      <Button type="button" variant="secondary" size="sm" asChild>
                        <Link href={`/messaging/p/${encodeURIComponent(partner.slug)}`}>
                          {t.openChatLink}
                        </Link>
                      </Button>
                    ) : null}
                    {website ? (
                      <PartnerWebsiteRevisionMenu
                        locale={locale}
                        partnerId={partnerId}
                        disabled={!partnerId || publishing}
                        onRestored={handleWebsiteRestored}
                        onPreviewVersion={(theme) => setLiveTheme(theme)}
                        onExitPreview={() => setLiveTheme(website?.theme ?? null)}
                        onError={(message) => toast({ title: message, variant: 'destructive' })}
                      />
                    ) : null}
                    {website ? (
                      <PartnerWebsiteResetDialog
                        partnerId={partnerId}
                        partnerTitle={partnerTitle}
                        t={t}
                        disabled={!partnerId || publishing || chatBusy}
                        onResetComplete={handleWebsiteResetComplete}
                      />
                    ) : null}
                    {publicUrl ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {publicUrl.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : previewPath ? (
                      <span className="ml-auto text-xs text-muted-foreground">{t.publishToView}</span>
                    ) : null}
                  </div>
                ) : provisioning ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.provisioning}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.emptyState}</p>
                )}
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-0 sm:px-4">
                <PartnerWebsiteDevicePreview
                  ref={previewRef}
                  locale={locale}
                  partnerId={partnerId}
                  previewVersion={previewVersion}
                  liveTheme={liveTheme ?? website?.theme ?? null}
                  publicUrl={publicUrl}
                  siteSlug={website?.siteSlug}
                  hasWebsite={Boolean(website)}
                  embedded
                  quickEditDisabled={chatBusy || !website}
                  visualEditEnabled={Boolean(website)}
                  websiteTitle={website?.title}
                  project={website?.project}
                  htmlSource={website?.htmlSource}
                  useVisualHtml={Boolean(website?.theme?.useVisualHtml)}
                  onVisualEditSave={website ? handleVisualEditSave : undefined}
                  onVisualEditError={(message) => toast({ title: message, variant: 'destructive' })}
                  onLiveThemeChange={setLiveTheme}
                  onThemePersisted={(theme, extras) => {
                    setLiveTheme(theme)
                    setWebsite((prev) =>
                      prev
                        ? {
                            ...prev,
                            theme,
                            ...(extras?.htmlSource !== undefined ? { htmlSource: extras.htmlSource } : {}),
                            ...(extras?.project ? { project: extras.project } : {}),
                          }
                        : prev
                    )
                    setPreviewVersion(String(Date.now()))
                  }}
                  onAdminLogoChange={(url) => {
                    setLogoUrl(url)
                    setWebsite((prev) => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        logoUrl: url,
                        theme: { ...prev.theme, logoUrl: url },
                        project: applyFirstImageLogoToProject(prev.project, url, prev.title),
                        htmlSource: prev.htmlSource
                          ? applyFirstImageLogoToHtml(prev.htmlSource, url, prev.title)
                          : prev.htmlSource,
                      }
                    })
                  }}
                />
                {website ? (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <PartnerWebsiteCapabilitiesPanel
                      locale={locale}
                      t={t}
                      partnerId={partnerId}
                      sectionId="partner-website-capabilities"
                      compact
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
            </div>

            <div className={sectionWrapClass('partner-website-categories')}>
            <PartnerWebsiteCategoriesPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              sectionId="partner-website-categories"
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
            />
            </div>

            <div className={sectionWrapClass('partner-website-reviews-qa')}>
            <PartnerWebsiteReviewsQaPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              sectionId="partner-website-reviews-qa"
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
            />
            </div>

            <div className={sectionWrapClass('partner-website-customers')}>
            <PartnerWebsiteCustomersPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              sectionId="partner-website-customers"
            />
            </div>

            <div className={sectionWrapClass('partner-website-static-pages')}>
            <PartnerWebsiteStaticPagesPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              siteSlug={website?.siteSlug}
              sectionId="partner-website-static-pages"
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
              onOpenVisualEdit={(pageSelect) => {
                previewRef.current?.openVisualEditPage(pageSelect)
                document.getElementById('partner-website-device-preview')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
            />
            </div>

            <div className={sectionWrapClass('partner-website-promotions')}>
            <PartnerWebsitePromotionsPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              sectionId="partner-website-promotions"
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
            />
            </div>

            <div className={sectionWrapClass('partner-website-landings')}>
            <PartnerWebsiteLandingsPanel
              locale={locale}
              t={t}
              partnerId={partnerId}
              siteSlug={website?.siteSlug}
              websiteReady={canOpenLanding}
              sectionId="partner-website-landings"
              autoStartChat={autoStartLandingChat}
              onChatStarted={() => setAutoStartLandingChat(false)}
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
            />
            </div>

            <div className={sectionWrapClass('partner-website-floating-cta')}>
            <PartnerWebsiteFloatingCtaPanel
              locale={locale}
              website={website}
              partnerId={partnerId}
              sectionId="partner-website-floating-cta"
              onToast={(message, variant) =>
                toast({ title: message, variant: variant === 'destructive' ? 'destructive' : 'default' })
              }
              onWebsiteRefresh={handleWebsiteRefresh}
            />
            </div>

            <div className={sectionWrapClass('partner-website-leads')}>
            <PartnerWebsiteLeadsPanel
              locale={locale}
              partnerId={partnerId}
              enabled
              sectionId="partner-website-leads"
            />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
