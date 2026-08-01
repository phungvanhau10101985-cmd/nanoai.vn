'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { partnerWebsiteDashboardPath } from '@/lib/partner-website/partner-website-dashboard-path'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { WebLocale } from '@/lib/i18n/config'
import { PartnerWebsiteChatPanel, type PartnerWebsiteChatPanelHandle } from '@/components/partner-website/partner-website-chat-panel'
import { PartnerWebsiteDevicePreview } from '@/components/partner-website/partner-website-device-preview'
import { PartnerWebsiteProjectFilesPanel } from '@/components/partner-website/partner-website-project-files-panel'
import { PartnerWebsiteLeadsPanel } from '@/components/partner-website/partner-website-leads-panel'
import { PartnerWebsiteSectionsPanel } from '@/components/partner-website/partner-website-sections-panel'
import { PartnerWebsiteRevisionMenu } from '@/components/partner-website/partner-website-revision-menu'
import {
  PartnerWebsiteTenantAdminBar,
  type PartnerWebsiteTenantSection,
} from '@/components/partner-website/partner-website-tenant-admin-bar'
import type { FileDiff } from '@/lib/partner-website/partner-website-line-diff'
import { ExternalLink, Globe, Loader2 } from 'lucide-react'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']

type NavLabels = {
  inbox: string
  orders: string
  marketing: string
  settings: string
  website: string
}

function resolveSelectedFile(website: PartnerWebsiteRow, diffPath?: string): string {
  if (diffPath?.trim()) return diffPath.trim()
  if (website.renderMode === 'template') return 'site.config.json'
  return website.project.entryPath || 'index.html'
}

type Props = {
  locale: WebLocale
  partners: PartnerRow[]
  hadPartnersWithoutWebsitePerm?: boolean
  initialWebsites: Record<string, PartnerWebsiteRow | null>
  initialPartnerId: string
  navLabels: NavLabels
  hidePartnerPicker?: boolean
  lockedPartnerSlug?: string
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
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const { toast } = useToast()
  const router = useRouter()

  const [partnerId, setPartnerId] = useState(initialPartnerId || partners[0]?.id || '')
  const initialPartner = partners.find((p) => p.id === (initialPartnerId || partners[0]?.id)) ?? null
  const initialWebsiteRow =
    initialWebsites[initialPartnerId] ?? initialWebsites[partners[0]?.id ?? ''] ?? null
  const [website, setWebsite] = useState<PartnerWebsiteRow | null>(initialWebsiteRow)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(
    initialWebsiteRow?.logoUrl ?? initialPartner?.logo_url?.trim() ?? ''
  )
  const [refUrlsText, setRefUrlsText] = useState(
    initialWebsiteRow?.referenceImageUrls.filter((u) => /^https?:\/\//i.test(u)).join('\n') ?? ''
  )
  const [uploadedRefUrls, setUploadedRefUrls] = useState<string[]>(
    initialWebsiteRow?.referenceImageUrls.filter((u) => /^https?:\/\//i.test(u)) ?? []
  )
  const [publishing, setPublishing] = useState(false)
  const [selectedFile, setSelectedFile] = useState(() =>
    initialWebsiteRow ? resolveSelectedFile(initialWebsiteRow) : 'index.html'
  )
  const [activeSection, setActiveSection] = useState<PartnerWebsiteTenantSection>('editor')
  const [previewVersion, setPreviewVersion] = useState(
    initialWebsiteRow?.updatedAt ?? String(Date.now())
  )
  const [chatBusy, setChatBusy] = useState(false)
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([])
  const [provisioning, setProvisioning] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const chatRef = useRef<PartnerWebsiteChatPanelHandle>(null)

  const partner = useMemo(() => partners.find((p) => p.id === partnerId) ?? null, [partners, partnerId])
  const partnerTitle =
    website?.title?.trim() || partner?.brand_name || partner?.display_name || 'Website'

  function splitReferenceUrls(urls: string[]): { uploaded: string[]; text: string } {
    const httpUrls = urls.filter((u) => /^https?:\/\//i.test(u.trim()))
    return { uploaded: httpUrls, text: httpUrls.join('\n') }
  }

  function applyWebsiteRefs(urls: string[]) {
    const split = splitReferenceUrls(urls)
    setUploadedRefUrls(split.uploaded)
    setRefUrlsText(split.text)
  }

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
          applyWebsiteRefs(json.website.referenceImageUrls)
          setSelectedFile(
            json.website.renderMode === 'template'
              ? 'site.config.json'
              : json.website.project.entryPath || 'index.html'
          )
          setPreviewVersion(json.website.updatedAt || String(Date.now()))
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
    [locale, t.autoProvisionHint, t.autoProvisionTitle, t.errorGeneric, toast]
  )

  useEffect(() => {
    if (partnerId) void loadWebsite(partnerId)
  }, [partnerId, loadWebsite])

  function onPartnerChange(nextId: string) {
    setPartnerId(nextId)
    setFileDiffs([])
    const cached = initialWebsites[nextId]
    const nextPartner = partners.find((p) => p.id === nextId)
    if (cached) {
      setWebsite(cached)
      setLogoUrl(cached.logoUrl ?? nextPartner?.logo_url?.trim() ?? '')
      applyWebsiteRefs(cached.referenceImageUrls)
      setSelectedFile(resolveSelectedFile(cached))
      setPreviewVersion(cached.updatedAt || String(Date.now()))
    } else {
      setWebsite(null)
      setLogoUrl(nextPartner?.logo_url?.trim() ?? '')
      setUploadedRefUrls([])
      setRefUrlsText('')
      setPreviewVersion(String(Date.now()))
    }
    void loadWebsite(nextId)
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
      setSelectedFile(resolveSelectedFile(json.website))
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
    fileDiffs?: FileDiff[]
  }) {
    setWebsite(payload.website)
    setPublicUrl(payload.publicUrl)
    setLogoUrl(payload.website.logoUrl ?? logoUrl)
    applyWebsiteRefs(payload.website.referenceImageUrls)
    const nextDiffs = payload.fileDiffs ?? []
    setFileDiffs(nextDiffs)
    setSelectedFile(resolveSelectedFile(payload.website, nextDiffs[0]?.path))
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
    applyWebsiteRefs(payload.website.referenceImageUrls)
    setFileDiffs([])
    setSelectedFile(resolveSelectedFile(payload.website))
    setPreviewVersion(payload.website.updatedAt || String(Date.now()))
    toast({ title: t.restoreSuccess })
    router.refresh()
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

  const previewPath = website ? partnerWebsitePublicPath(website.siteSlug) : null

  const handleQuickEdit = useCallback((prompt: string) => {
    void chatRef.current?.sendMessage(prompt)
  }, [])

  const scrollToSection = useCallback((section: PartnerWebsiteTenantSection) => {
    setActiveSection(section)
    const id =
      section === 'editor'
        ? 'partner-website-editor'
        : section === 'leads'
          ? 'partner-website-leads'
          : 'partner-website-sections'
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-0 md:px-2">
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
          {!hidePartnerPicker ? (
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
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {website?.renderMode === 'legacy' ? (
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
          ) : null}

          {website || provisioning ? (
            <PartnerWebsiteTenantAdminBar
              partnerTitle={partnerTitle}
              siteSlug={website?.siteSlug}
              isPublished={Boolean(website?.isPublished)}
              publishedLabel={t.publishedBadge}
              draftLabel={t.draftBadge}
              publicUrl={publicUrl}
              sections={{
                editor: t.tenantNavEditor,
                leads: t.tenantNavLeads,
                sections: t.tenantNavSections,
                publicSite: t.tenantNavPublicSite,
              }}
              activeSection={activeSection}
              onSectionSelect={scrollToSection}
            />
          ) : null}

          <div className="flex min-h-[calc(100dvh-12rem)] flex-1 flex-col gap-4">
            <div
              id="partner-website-editor"
              className="grid min-h-0 flex-1 scroll-mt-24 gap-4 lg:grid-cols-[minmax(360px,420px)_1fr] lg:items-stretch"
            >
              <PartnerWebsiteChatPanel
                ref={chatRef}
                locale={locale}
                partnerId={partnerId}
                partnerTitle={partnerTitle}
                website={website}
                logoUrl={logoUrl}
                onLogoUrlChange={setLogoUrl}
                refUrlsText={refUrlsText}
                onRefUrlsTextChange={setRefUrlsText}
                uploadedRefUrls={uploadedRefUrls}
                onUploadedRefUrlsChange={setUploadedRefUrls}
                disabled={!partnerId}
                onBusyChange={setChatBusy}
                onError={(message) => toast({ title: message, variant: 'destructive' })}
                onWebsiteUpdated={handleWebsiteUpdated}
              />

              <Card className="flex h-full min-h-0 flex-col">
              <CardHeader className="shrink-0 space-y-3 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4 shrink-0" />
                      {t.previewTitle}
                    </CardTitle>
                    <CardDescription className="mt-1">{t.publishSectionHint}</CardDescription>
                  </div>
                </div>

                {website ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!website}
                      asChild={Boolean(website && partnerId)}
                    >
                      {website && partnerId ? (
                        <a
                          href={`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/preview`}
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
                      disabled={publishing || website.isPublished}
                      onClick={() => void handlePublish(true)}
                    >
                      {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t.publishButton}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                        onError={(message) => toast({ title: message, variant: 'destructive' })}
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

              <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
                <PartnerWebsiteDevicePreview
                  locale={locale}
                  partnerId={partnerId}
                  previewVersion={previewVersion}
                  publicUrl={publicUrl}
                  siteSlug={website?.siteSlug}
                  hasWebsite={Boolean(website)}
                  embedded
                  onQuickEdit={website ? handleQuickEdit : undefined}
                  quickEditDisabled={chatBusy || !website}
                />
              </CardContent>
            </Card>
            </div>

            <PartnerWebsiteSectionsPanel locale={locale} website={website} sectionId="partner-website-sections" />

            <PartnerWebsiteLeadsPanel
              locale={locale}
              partnerId={partnerId}
              enabled={Boolean(website?.renderMode === 'template')}
              sectionId="partner-website-leads"
            />

            <PartnerWebsiteProjectFilesPanel
              locale={locale}
              website={website}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              fileDiffs={fileDiffs}
              layout="bottom"
            />
          </div>
        </>
      )}
    </div>
  )
}
