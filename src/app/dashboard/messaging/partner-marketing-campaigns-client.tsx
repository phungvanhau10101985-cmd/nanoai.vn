'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  cancelMarketingCampaign,
  createMarketingCampaignDraft,
  getMarketingCampaignDetail,
  getMarketingOptOutCount,
  listMarketingSegmentRecipientsFull,
  listPartnerMarketingCampaigns,
  previewMarketingSegment,
  queueMarketingCampaign,
  sendMarketingTestEmail,
  updateMarketingCampaignDraft,
} from '@/app/dashboard/messaging/marketing-actions'
import type { MarketingCampaignRow } from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import {
  DEFAULT_MARKETING_SEGMENT,
  DEFAULT_MARKETING_TEMPLATE_CHAT,
  MARKETING_MERGE_FIELD_HINTS,
  type MarketingSegmentJson,
} from '@/lib/messaging/partner-marketing-segment'
import { List, Megaphone, RefreshCw } from 'lucide-react'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']

type SegmentRecipientRow = {
  conversationId: string
  recipientKey: string
  customerName: string | null
  email: string | null
  lastMessageAt: string | null
}

function formatSendLimitsNote(
  template: string,
  input: {
    emailsSent: number
    chatSent: number
    emailDays: number
    chatDays: number
  }
): string {
  const emailPerMonth = Math.max(1, Math.floor(30 / Math.max(1, input.emailDays)))
  return template
    .replace('{emailsSent}', String(input.emailsSent))
    .replace('{chatSent}', String(input.chatSent))
    .replace('{emailDays}', String(input.emailDays))
    .replace('{chatDays}', String(input.chatDays))
    .replace('{emailPerMonth}', String(emailPerMonth))
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'running' || status === 'queued') return 'secondary'
  if (status === 'failed' || status === 'cancelled') return 'destructive'
  return 'outline'
}

export function PartnerMarketingCampaignsClient({
  initialPartners,
  marketingT,
  locale,
}: {
  initialPartners: PartnerRow[]
  marketingT: Dictionary['partnerMessagingMarketing']
  locale: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const partnerFromUrl = searchParams.get('partner')?.trim() ?? ''
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    initialPartners.some((p) => p.id === partnerFromUrl) ? partnerFromUrl : initialPartners[0]?.id ?? ''
  )
  const [segmentCount, setSegmentCount] = useState<number | null>(null)
  const [samples, setSamples] = useState<SegmentRecipientRow[]>([])
  const [emailsSentThisMonth, setEmailsSentThisMonth] = useState(0)
  const [chatSentThisMonth, setChatSentThisMonth] = useState(0)
  const [emailCooldownDays, setEmailCooldownDays] = useState(7)
  const [chatCooldownDays, setChatCooldownDays] = useState(14)
  const [fullListOpen, setFullListOpen] = useState(false)
  const [fullList, setFullList] = useState<SegmentRecipientRow[]>([])
  const [fullListLoading, setFullListLoading] = useState(false)
  const [templateBody, setTemplateBody] = useState(DEFAULT_MARKETING_TEMPLATE_CHAT)
  const [offerPercent, setOfferPercent] = useState('')
  const [channelEmail, setChannelEmail] = useState(false)
  const [emailIntro, setEmailIntro] = useState('')
  const [optOutCount, setOptOutCount] = useState<number | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [campaigns, setCampaigns] = useState<MarketingCampaignRow[]>([])
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<
    Array<{
      id: string
      recipient_key: string
      email: string | null
      status: string
      skip_reason: string | null
    }>
  >([])

  const selectedPartner = useMemo(
    () => initialPartners.find((p) => p.id === selectedPartnerId) ?? null,
    [initialPartners, selectedPartnerId]
  )

  const segmentJson: MarketingSegmentJson = DEFAULT_MARKETING_SEGMENT

  const loadPreview = useCallback(() => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await previewMarketingSegment(selectedPartnerId, segmentJson)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      if (!('ok' in res) || !res.ok) return
      setSegmentCount(res.count)
      setSamples(res.samples)
      setEmailsSentThisMonth(res.emailsSentThisMonth)
      setChatSentThisMonth(res.chatSentThisMonth)
      setEmailCooldownDays(res.emailCooldownDays)
      setChatCooldownDays(res.chatCooldownDays)
    })
  }, [selectedPartnerId, segmentJson, toast])

  const handleOpenFullList = async () => {
    if (!selectedPartnerId || fullListLoading) return
    setFullListOpen(true)
    setFullListLoading(true)
    try {
      const res = await listMarketingSegmentRecipientsFull(selectedPartnerId, segmentJson)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        setFullListOpen(false)
        return
      }
      if ('ok' in res && res.ok) {
        setFullList(res.recipients)
      }
    } finally {
      setFullListLoading(false)
    }
  }

  const loadCampaigns = useCallback(() => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await listPartnerMarketingCampaigns(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      if ('ok' in res && res.ok) setCampaigns(res.campaigns)
    })
  }, [selectedPartnerId, toast])

  const loadOptOutCount = useCallback(() => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await getMarketingOptOutCount(selectedPartnerId)
      if ('ok' in res && res.ok) setOptOutCount(res.count)
    })
  }, [selectedPartnerId])

  const handleSendTest = async () => {
    if (!selectedPartnerId || testSending) return
    const to = testEmail.trim()
    if (!to) {
      toast({ title: marketingT.testEmailInvalid, variant: 'destructive' })
      return
    }
    const pct = offerPercent.trim() ? Number(offerPercent) : null
    setTestSending(true)
    try {
      const res = await sendMarketingTestEmail({
        partnerId: selectedPartnerId,
        toEmail: to,
        offerPercent: pct,
        emailIntro: emailIntro.trim() || null,
      })
      if ('error' in res && res.error) {
        const map: Record<string, string> = {
          INVALID_EMAIL: marketingT.testEmailInvalid,
          EMAIL_NOT_CUSTOMER: marketingT.testEmailNotCustomer,
          SMTP_NOT_CONFIGURED: marketingT.smtpNotConfigured,
        }
        toast({ title: map[String(res.error)] ?? String(res.error), variant: 'destructive' })
        return
      }
      if ('ok' in res && res.ok) {
        toast({ title: marketingT.testEmailSent.replace('{to}', res.to) })
      }
    } finally {
      setTestSending(false)
    }
  }

  useEffect(() => {
    if (!selectedPartnerId) return
    loadPreview()
    loadCampaigns()
    loadOptOutCount()
  }, [selectedPartnerId, loadPreview, loadCampaigns, loadOptOutCount])

  useEffect(() => {
    if (!selectedPartnerId) return
    // Chỉ ghi URL khi param chưa khớp — tránh vòng lặp replace → searchParams đổi → effect chạy lại.
    if (partnerFromUrl === selectedPartnerId) return
    const q = new URLSearchParams(searchParams.toString())
    q.set('partner', selectedPartnerId)
    router.replace(`/dashboard/messaging/marketing?${q.toString()}`, { scroll: false })
  }, [selectedPartnerId, router, searchParams, partnerFromUrl])

  const loadCampaignDetail = (campaignId: string) => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await getMarketingCampaignDetail(selectedPartnerId, campaignId)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      if (!('ok' in res) || !res.ok) return
      setActiveCampaignId(campaignId)
      setDeliveries(
        res.deliveries.map((d) => ({
          id: d.id,
          recipient_key: d.recipient_key,
          email: d.email,
          status: d.status,
          skip_reason: d.skip_reason,
        }))
      )
    })
  }

  const handleCreateAndQueue = async () => {
    if (!selectedPartnerId || sending) return
    if (!segmentCount || segmentCount <= 0) {
      toast({ title: marketingT.noRecipients, variant: 'destructive' })
      return
    }
    const pct = offerPercent.trim() ? Number(offerPercent) : null
    setSending(true)
    try {
      const created = await createMarketingCampaignDraft({
        partnerId: selectedPartnerId,
        segmentJson,
        templateBodyChat: templateBody,
        offerPercent: pct,
        channelEmail,
        templateBodyEmail: emailIntro.trim() || null,
      })
      if ('error' in created && created.error) {
        toast({ title: String(created.error), variant: 'destructive' })
        return
      }
      if (!('ok' in created) || !created.ok || !created.campaign) return

      const queued = await queueMarketingCampaign(selectedPartnerId, created.campaign.id)
      if ('error' in queued && queued.error) {
        if (queued.error === 'NO_RECIPIENTS') {
          toast({ title: marketingT.noRecipients, variant: 'destructive' })
        } else {
          toast({ title: String(queued.error), variant: 'destructive' })
        }
        return
      }
      toast({
        title: marketingT.queueSuccessTitle,
        description: marketingT.queueSuccessDescription.replace('{count}', String(queued.totalQueued ?? 0)),
      })
      loadCampaigns()
      loadCampaignDetail(created.campaign.id)
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = () => {
    if (!selectedPartnerId || !activeCampaignId) return
    const pct = offerPercent.trim() ? Number(offerPercent) : null
    startTransition(async () => {
      const res = await updateMarketingCampaignDraft({
        partnerId: selectedPartnerId,
        campaignId: activeCampaignId,
        templateBodyChat: templateBody,
        offerPercent: pct,
        channelEmail,
        templateBodyEmail: emailIntro.trim() || null,
      })
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      toast({ title: marketingT.draftSaved })
      loadCampaigns()
    })
  }

  const handleCancel = (campaignId: string) => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await cancelMarketingCampaign(selectedPartnerId, campaignId)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      toast({ title: marketingT.cancelled })
      loadCampaigns()
    })
  }

  if (!initialPartners.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{marketingT.noWorkspace}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{marketingT.workspaceLabel}</CardTitle>
          <CardDescription>{marketingT.safeModeNote}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {initialPartners.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={p.id === selectedPartnerId ? 'default' : 'outline'}
              onClick={() => setSelectedPartnerId(p.id)}
            >
              {p.display_name?.trim() || p.brand_name?.trim() || p.slug}
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{marketingT.stepAudience}</CardTitle>
            <CardDescription>{marketingT.audienceHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {marketingT.segmentPresetLabel}: <strong>{marketingT.segmentChat90d}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              {segmentCount != null
                ? marketingT.recipientCount.replace('{count}', String(segmentCount))
                : marketingT.loadingCount}
            </p>
            {segmentCount != null && (
              <p className="text-xs text-muted-foreground">
                {formatSendLimitsNote(marketingT.sendLimitsThisMonth, {
                  emailsSent: emailsSentThisMonth,
                  chatSent: chatSentThisMonth,
                  emailDays: emailCooldownDays,
                  chatDays: chatCooldownDays,
                })}
              </p>
            )}
            {samples.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {samples.map((s) => (
                  <li key={s.recipientKey}>
                    • {s.customerName ?? s.email ?? s.recipientKey}
                    {s.email ? ` — ${s.email}` : ''}
                    {s.lastMessageAt ? ` — ${new Date(s.lastMessageAt).toLocaleDateString(locale)}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={loadPreview} disabled={pending}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {marketingT.refreshPreview}
              </Button>
              {segmentCount != null && segmentCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleOpenFullList}
                  disabled={fullListLoading}
                >
                  <List className="mr-1 h-3.5 w-3.5" />
                  {marketingT.viewAllRecipients.replace('{count}', String(segmentCount))}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{marketingT.stepContent}</CardTitle>
            <CardDescription>{marketingT.contentHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-pct">{marketingT.offerPercentLabel}</Label>
              <Input
                id="offer-pct"
                inputMode="numeric"
                value={offerPercent}
                onChange={(e) => setOfferPercent(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-body">{marketingT.templateLabel}</Label>
              <Textarea
                id="template-body"
                rows={10}
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {marketingT.mergeFieldsLabel}: {MARKETING_MERGE_FIELD_HINTS.join(', ')}
            </p>
            <p className="text-xs text-muted-foreground">{marketingT.personalizationNote}</p>

            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-violet-600"
                  checked={channelEmail}
                  onChange={(e) => setChannelEmail(e.target.checked)}
                />
                <span className="font-medium">{marketingT.channelEmailLabel}</span>
              </label>
              <p className="pl-6 text-xs text-muted-foreground">{marketingT.channelEmailHint}</p>
              {channelEmail && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="email-intro">{marketingT.emailIntroLabel}</Label>
                  <Textarea
                    id="email-intro"
                    rows={2}
                    value={emailIntro}
                    onChange={(e) => setEmailIntro(e.target.value.slice(0, 2000))}
                    placeholder={marketingT.emailIntroPlaceholder}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{marketingT.stepSend}</CardTitle>
          <CardDescription>{marketingT.sendHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleCreateAndQueue}
            disabled={sending || !selectedPartner || !segmentCount || segmentCount <= 0}
          >
            <Megaphone className="mr-1 h-4 w-4" />
            {marketingT.sendButton}
          </Button>
          {activeCampaignId && (
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={sending}>
              {marketingT.saveDraft}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{marketingT.testOptOutTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {marketingT.optOutCountLabel.replace('{count}', String(optOutCount ?? 0))}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="test-email">{marketingT.testEmailLabel}</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={marketingT.testEmailPlaceholder}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSendTest}
              disabled={testSending || !selectedPartner || !testEmail.trim()}
            >
              {marketingT.sendTestButton}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{marketingT.campaignHistory}</CardTitle>
            <CardDescription>{marketingT.campaignHistoryHint}</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={loadCampaigns} disabled={pending}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            {marketingT.reload}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {!campaigns.length && <p className="text-sm text-muted-foreground">{marketingT.noCampaigns}</p>}
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                  <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString(locale)}</span>
                </div>
                <p className="text-muted-foreground">
                  {marketingT.statsLine
                    .replace('{queued}', String(c.total_queued))
                    .replace('{sent}', String(c.sent_chat))
                    .replace('{skipped}', String(c.skipped))
                    .replace('{failed}', String(c.failed))}
                  {c.channel_email
                    ? ` · ${marketingT.emailStatsLabel.replace('{sentEmail}', String(c.sent_email))}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => loadCampaignDetail(c.id)}>
                  {marketingT.viewLog}
                </Button>
                {(c.status === 'queued' || c.status === 'running') && (
                  <Button type="button" size="sm" variant="destructive" onClick={() => handleCancel(c.id)}>
                    {marketingT.cancelCampaign}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {deliveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{marketingT.deliveryLog}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">{marketingT.colRecipient}</th>
                    <th className="py-1 pr-2">{marketingT.colStatus}</th>
                    <th className="py-1">{marketingT.colReason}</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-border/40">
                      <td className="py-1 pr-2 text-xs">{d.email ?? d.recipient_key}</td>
                      <td className="py-1 pr-2">{d.status}</td>
                      <td className="py-1 text-muted-foreground">{d.skip_reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={fullListOpen} onOpenChange={setFullListOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{marketingT.recipientListTitle}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto text-sm">
            {fullListLoading ? (
              <p className="text-muted-foreground">{marketingT.loadingCount}</p>
            ) : fullList.length === 0 ? (
              <p className="text-muted-foreground">{marketingT.noRecipients}</p>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">{marketingT.colName}</th>
                    <th className="py-1 pr-2">{marketingT.colEmail}</th>
                    <th className="py-1">{marketingT.colLastChat}</th>
                  </tr>
                </thead>
                <tbody>
                  {fullList.map((r) => (
                    <tr key={r.recipientKey} className="border-b border-border/40">
                      <td className="py-1 pr-2">{r.customerName ?? '—'}</td>
                      <td className="py-1 pr-2 text-xs">{r.email ?? '—'}</td>
                      <td className="py-1 text-muted-foreground">
                        {r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleDateString(locale) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
