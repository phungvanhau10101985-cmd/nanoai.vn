'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  createMessagingWorkspace,
  getPartnerChannelStatus,
  listMyMessagingPartners,
  savePartnerFacebookChannel,
  savePartnerZaloChannel,
} from '@/app/dashboard/messaging/actions'
import { PartnerAiSettingsPanel } from '@/app/dashboard/messaging/partner-ai-settings-panel'
import { ArrowLeft, Copy, RefreshCw } from 'lucide-react'

type ChannelSnap = {
  facebookPageId: string | null
  facebookHasToken: boolean
  facebookHasVerify: boolean
  zaloConfigured: boolean
}

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type T = Dictionary['partnerMessaging']
type TAi = Dictionary['partnerMessagingAi']

export function PartnerMessagingSettingsClient({
  initialPartners,
  embedBaseUrl,
  t,
  tAi,
  partnerAiLlmModel,
}: {
  initialPartners: PartnerRow[]
  embedBaseUrl: string
  t: T
  tAi: TAi
  partnerAiLlmModel: string
}) {
  const { toast } = useToast()
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initialPartners[0]?.id ?? null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [fbPageId, setFbPageId] = useState('')
  const [fbToken, setFbToken] = useState('')
  const [fbVerify, setFbVerify] = useState('')
  const [zaloSec, setZaloSec] = useState('')
  const [zaloTok, setZaloTok] = useState('')
  const [pending, startTransition] = useTransition()
  const [channelSnap, setChannelSnap] = useState<ChannelSnap | null>(null)
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId)

  const loadChannelStatus = useCallback(() => {
    if (!selectedPartnerId) {
      setChannelSnap(null)
      return
    }
    void (async () => {
      const res = await getPartnerChannelStatus(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('facebookPageId' in res) {
        setChannelSnap({
          facebookPageId: res.facebookPageId ?? null,
          facebookHasToken: Boolean(res.facebookHasToken),
          facebookHasVerify: Boolean(res.facebookHasVerify),
          zaloConfigured: Boolean(res.zaloConfigured),
        })
        setFbPageId(res.facebookPageId ?? '')
      }
    })()
  }, [selectedPartnerId])

  const refreshPartners = useCallback(() => {
    startTransition(async () => {
      const res = await listMyMessagingPartners()
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res) {
        const next = res.rows ?? []
        setPartners(next)
        if (!selectedPartnerId && next[0]) setSelectedPartnerId(next[0].id)
      }
    })
  }, [selectedPartnerId, toast])

  useEffect(() => {
    setFbToken('')
    setFbVerify('')
    setZaloSec('')
    setZaloTok('')
    loadChannelStatus()
  }, [selectedPartnerId, loadChannelStatus])

  const createWs = () => {
    if (!workspaceName.trim()) return
    startTransition(async () => {
      const res = await createMessagingWorkspace(workspaceName.trim())
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('partner' in res && res.partner) {
        setWorkspaceName('')
        setPartners((p) => [res.partner as PartnerRow, ...p])
        setSelectedPartnerId(res.partner.id)
        setShowAddWorkspace(false)
        toast({ title: t.saveOk })
      }
    })
  }

  const saveFb = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await savePartnerFacebookChannel(selectedPartnerId, fbPageId, fbToken, fbVerify)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.saveOk })
      loadChannelStatus()
    })
  }

  const saveZl = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await savePartnerZaloChannel(selectedPartnerId, zaloSec, zaloTok)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.saveOk })
      loadChannelStatus()
    })
  }

  const hostedChatUrl =
    embedBaseUrl && selectedPartner?.slug
      ? `${embedBaseUrl.replace(/\/$/, '')}/messaging/p/${encodeURIComponent(selectedPartner.slug)}`
      : ''

  const embedUrl =
    embedBaseUrl && selectedPartner?.slug
      ? `${embedBaseUrl.replace(/\/$/, '')}/api/messaging/embed/${selectedPartner.slug}`
      : ''

  const iframeTitleEscaped = t.nanoaiHostedIframeTitleAttr.replace(/"/g, '&quot;')
  const iframeSnippet =
    hostedChatUrl.length > 0
      ? `<iframe src="${hostedChatUrl.replace(/"/g, '&quot;')}" title="${iframeTitleEscaped}" width="100%" height="560" style="border:0;border-radius:12px;max-width:100%" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      : ''

  const copyIframeSnippet = () => {
    if (!iframeSnippet) return
    void navigator.clipboard.writeText(iframeSnippet).then(() => {
      toast({ title: t.iframeSnippetCopiedToast })
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/dashboard/messaging">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t.goToInbox}
          </Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={refreshPartners} disabled={pending}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {t.refresh}
        </Button>
      </div>

      {partners.length === 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t.createWorkspace}</CardTitle>
            <CardDescription className="text-xs">{t.cardDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ws-name-settings">{t.workspaceNameLabel}</Label>
              <Input
                id="ws-name-settings"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={t.workspaceNameLabel}
              />
            </div>
            <Button type="button" onClick={createWs} disabled={pending || !workspaceName.trim()}>
              {t.createButton}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t.setupColumnTitle}</p>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.workspaceLabel}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">{t.cardDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select
                value={selectedPartnerId ?? undefined}
                onValueChange={(v) => setSelectedPartnerId(v)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder={t.workspaceLabel} />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddWorkspace((v) => !v)}>
                {t.addAnotherWorkspace}
              </Button>
            </CardContent>
          </Card>

          {showAddWorkspace ? (
            <Card className="border-dashed border-violet-300/60 bg-violet-50/20 dark:border-violet-800/50 dark:bg-violet-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t.addAnotherWorkspace}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="ws-name-extra">{t.workspaceNameLabel}</Label>
                  <Input
                    id="ws-name-extra"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder={t.workspaceNameLabel}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={createWs} disabled={pending || !workspaceName.trim()}>
                    {t.createButton}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddWorkspace(false)}>
                    {t.cancelAddWorkspace}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.channelsSection}</CardTitle>
              <CardDescription className="text-xs">{t.credentialsKeepHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {channelSnap?.facebookPageId ? (
                <p className="text-xs text-muted-foreground">
                  {t.fbLinkedLine.replace('{pageId}', channelSnap.facebookPageId)}
                </p>
              ) : null}
              {channelSnap?.zaloConfigured ? <p className="text-xs text-muted-foreground">{t.zaloLinkedLine}</p> : null}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t.fbPageId}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={fbPageId}
                    onChange={(e) => setFbPageId(e.target.value)}
                    placeholder={t.fbPageId}
                  />
                  <Label className="text-xs font-medium">{t.fbPageToken}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={fbToken}
                    onChange={(e) => setFbToken(e.target.value)}
                    placeholder={t.fbPageToken}
                    type="password"
                  />
                  <Label className="text-xs font-medium">{t.fbVerifyToken}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={fbVerify}
                    onChange={(e) => setFbVerify(e.target.value)}
                    placeholder={t.fbVerifyToken}
                  />
                  <Button type="button" size="sm" className="mt-1" onClick={saveFb} disabled={pending}>
                    {t.saveFacebook}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t.zaloSecret}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={zaloSec}
                    onChange={(e) => setZaloSec(e.target.value)}
                    placeholder={t.zaloSecret}
                    type="password"
                  />
                  <Label className="text-xs font-medium">{t.zaloToken}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={zaloTok}
                    onChange={(e) => setZaloTok(e.target.value)}
                    placeholder={t.zaloToken}
                    type="password"
                  />
                  <Button type="button" size="sm" className="mt-1" onClick={saveZl} disabled={pending}>
                    {t.saveZalo}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {hostedChatUrl ? (
            <Card className="border-border/60 border-violet-500/25 bg-muted/30 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t.nanoaiHostedSection}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{t.nanoaiHostedHint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t.nanoaiHostedUrlLabel}
                  </p>
                  <code className="block break-all rounded-md border bg-background px-3 py-2 text-[11px] leading-relaxed">
                    {hostedChatUrl}
                  </code>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold text-foreground">{t.nanoaiHostedIframeTitle}</p>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{t.nanoaiHostedIframeHelp}</p>
                  <code className="mb-2 block max-h-40 overflow-auto break-all whitespace-pre-wrap rounded-md border bg-background px-3 py-2 text-[10px] leading-relaxed">
                    {iframeSnippet}
                  </code>
                  <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={copyIframeSnippet}>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    {t.copyIframeSnippetButton}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {embedUrl ? (
            <Card className="border-border/60 bg-muted/30 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{t.embedSection}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">{t.embedHint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <code className="block break-all rounded-md border bg-background px-3 py-2 text-[11px] leading-relaxed">
                  {embedUrl}
                </code>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t.embedHeadersHelp}{' '}
                  <span className="font-mono text-[10px]">X-Embed-Key</span> = {selectedPartner?.embed_key}
                </p>
                <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
                  {t.embedAnonymousFootnote}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {selectedPartnerId ? (
            <PartnerAiSettingsPanel
              partnerId={selectedPartnerId}
              t={tAi}
              saveOkMessage={t.saveOk}
              aiModelId={partnerAiLlmModel}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
