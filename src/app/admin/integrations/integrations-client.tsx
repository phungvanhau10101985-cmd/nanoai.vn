'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Copy, Plus, Trash2 } from 'lucide-react'
import {
  loadAdminIntegrationsConfigAction,
  saveAdminIntegrationsConfigAction,
} from './actions'

type DomainVerificationInput = {
  name: string
  code: string
}

type Props = {
  title: string
  description: string
  googleAnalyticsLabel: string
  googleAnalyticsPlaceholder: string
  googleTagManagerLabel: string
  googleTagManagerPlaceholder: string
  facebookPixelLabel: string
  facebookPixelPlaceholder: string
  facebookCapiTokenLabel: string
  facebookCapiTokenPlaceholder: string
  facebookDatasetIdLabel: string
  facebookDatasetIdPlaceholder: string
  facebookTestEventCodeLabel: string
  facebookTestEventCodePlaceholder: string
  facebookCatalogFeedLabel: string
  facebookCatalogFeedHint: string
  copyFacebookCatalogFeedButton: string
  facebookCatalogFeedUrl: string
  webConsoleVerificationLabel: string
  webConsoleVerificationPlaceholder: string
  domainVerificationTitle: string
  domainVerificationNameLabel: string
  domainVerificationCodeLabel: string
  domainVerificationNamePlaceholder: string
  domainVerificationCodePlaceholder: string
  addDomainVerificationButton: string
  removeDomainVerificationButton: string
  nanoaiEmbedCodeLabel: string
  facebookChatEmbedCodeLabel: string
  zaloChatEmbedCodeLabel: string
  embedCodePlaceholder: string
  copyNanoaiEmbedButton: string
  copyFacebookChatEmbedButton: string
  copyZaloChatEmbedButton: string
  copiedToast: string
  nanoaiEmbedCodeDefault: string
  saveButtonLabel: string
  saveOkToast: string
  invalidGoogleAnalyticsToast: string
  invalidGoogleTagManagerToast: string
}

export function AdminIntegrationsClient(props: Props) {
  const { toast } = useToast()
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState('')
  const [googleTagManagerId, setGoogleTagManagerId] = useState('')
  const [facebookPixelId, setFacebookPixelId] = useState('')
  const [facebookCapiAccessToken, setFacebookCapiAccessToken] = useState('')
  const [facebookDatasetId, setFacebookDatasetId] = useState('')
  const [facebookTestEventCode, setFacebookTestEventCode] = useState('')
  const [webConsoleVerificationTag, setWebConsoleVerificationTag] = useState('')
  const [domainVerificationTags, setDomainVerificationTags] = useState<DomainVerificationInput[]>([])
  const [nanoaiEmbedCode, setNanoaiEmbedCode] = useState(props.nanoaiEmbedCodeDefault)
  const [facebookChatEmbedCode, setFacebookChatEmbedCode] = useState('')
  const [zaloChatEmbedCode, setZaloChatEmbedCode] = useState('')
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    startLoading(async () => {
      const res = await loadAdminIntegrationsConfigAction(props.nanoaiEmbedCodeDefault)
      if ('error' in res) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setGoogleAnalyticsId(res.data.googleAnalyticsId)
      setGoogleTagManagerId(res.data.googleTagManagerId)
      setFacebookPixelId(res.data.facebookPixelId)
      setFacebookCapiAccessToken(res.data.facebookCapiAccessToken || '')
      setFacebookDatasetId(res.data.facebookDatasetId || '')
      setFacebookTestEventCode(res.data.facebookTestEventCode || '')
      setWebConsoleVerificationTag(res.data.webConsoleVerificationTag)
      setDomainVerificationTags(res.data.domainVerificationTags || [])
      setNanoaiEmbedCode(res.data.chatEmbedCode)
      setFacebookChatEmbedCode(res.data.facebookChatEmbedCode)
      setZaloChatEmbedCode(res.data.zaloChatEmbedCode)
    })
  }, [props.nanoaiEmbedCodeDefault, toast])

  const copyText = (value: string) => {
    if (!value.trim()) return
    void navigator.clipboard.writeText(value).then(() => {
      toast({ title: props.copiedToast })
    })
  }

  const saveConfig = () => {
    const gaValue = googleAnalyticsId.trim()
    const gtmValue = googleTagManagerId.trim()
    if (gaValue && !/^G-[A-Z0-9]+$/i.test(gaValue)) {
      toast({ title: props.invalidGoogleAnalyticsToast, variant: 'destructive' })
      return
    }
    if (gtmValue && !/^GTM-[A-Z0-9]+$/i.test(gtmValue)) {
      toast({ title: props.invalidGoogleTagManagerToast, variant: 'destructive' })
      return
    }

    startSaving(async () => {
      const res = await saveAdminIntegrationsConfigAction(
        {
          googleAnalyticsId,
          googleTagManagerId,
          facebookPixelId,
          facebookCapiAccessToken,
          facebookDatasetId,
          facebookTestEventCode,
          webConsoleVerificationTag,
          domainVerificationTags,
          chatEmbedCode: nanoaiEmbedCode,
          nanoaiEmbedCode,
          facebookChatEmbedCode,
          zaloChatEmbedCode,
        },
        props.nanoaiEmbedCodeDefault
      )
      if ('error' in res) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: props.saveOkToast })
    })
  }

  const addDomainVerification = () => {
    setDomainVerificationTags((prev) => [...prev, { name: '', code: '' }])
  }

  const removeDomainVerification = (index: number) => {
    setDomainVerificationTags((prev) => prev.filter((_, i) => i !== index))
  }

  const updateDomainVerification = (
    index: number,
    key: keyof DomainVerificationInput,
    value: string
  ) => {
    setDomainVerificationTags((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  return (
    <Card className="border-border/60 bg-muted/30 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{props.title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{props.googleAnalyticsLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={googleAnalyticsId}
              onChange={(e) => setGoogleAnalyticsId(e.target.value)}
              placeholder={props.googleAnalyticsPlaceholder}
            />
            <p className="text-[11px] text-muted-foreground">Format: G-XXXXXXXXXX</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{props.googleTagManagerLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={googleTagManagerId}
              onChange={(e) => setGoogleTagManagerId(e.target.value)}
              placeholder={props.googleTagManagerPlaceholder}
            />
            <p className="text-[11px] text-muted-foreground">Format: GTM-XXXXXXX</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium">{props.webConsoleVerificationLabel}</Label>
            <Textarea
              value={webConsoleVerificationTag}
              onChange={(e) => setWebConsoleVerificationTag(e.target.value)}
              rows={2}
              className="resize-y text-[11px] leading-relaxed"
              placeholder={props.webConsoleVerificationPlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{props.facebookPixelLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={facebookPixelId}
              onChange={(e) => setFacebookPixelId(e.target.value)}
              placeholder={props.facebookPixelPlaceholder}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium">{props.facebookCapiTokenLabel}</Label>
            <Input
              className="h-9 text-sm"
              type="password"
              value={facebookCapiAccessToken}
              onChange={(e) => setFacebookCapiAccessToken(e.target.value)}
              placeholder={props.facebookCapiTokenPlaceholder}
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Dùng cho API Chuyển đổi máy chủ (CAPI). Có thể kết hợp Dataset ID và Test Event Code để kiểm tra quality.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{props.facebookDatasetIdLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={facebookDatasetId}
              onChange={(e) => setFacebookDatasetId(e.target.value)}
              placeholder={props.facebookDatasetIdPlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{props.facebookTestEventCodeLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={facebookTestEventCode}
              onChange={(e) => setFacebookTestEventCode(e.target.value)}
              placeholder={props.facebookTestEventCodePlaceholder}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-medium">{props.facebookCatalogFeedLabel}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="h-9 text-xs font-mono"
                value={props.facebookCatalogFeedUrl}
                readOnly
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5 sm:h-9"
                onClick={() => copyText(props.facebookCatalogFeedUrl)}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {props.copyFacebookCatalogFeedButton}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {props.facebookCatalogFeedHint}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">{props.domainVerificationTitle}</Label>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addDomainVerification}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {props.addDomainVerificationButton}
            </Button>
          </div>

          {domainVerificationTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">{props.domainVerificationCodePlaceholder}</p>
          ) : (
            <div className="space-y-3">
              {domainVerificationTags.map((row, index) => (
                <div key={`domain-tag-${index}`} className="space-y-2 rounded-md border border-border/50 p-2">
                  <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-center">
                    <div className="space-y-1">
                      <Label className="text-[11px]">{props.domainVerificationNameLabel}</Label>
                      <Input
                        className="h-8 text-xs"
                        value={row.name}
                        onChange={(e) => updateDomainVerification(index, 'name', e.target.value)}
                        placeholder={props.domainVerificationNamePlaceholder}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">{props.domainVerificationCodeLabel}</Label>
                      <Textarea
                        value={row.code}
                        onChange={(e) => updateDomainVerification(index, 'code', e.target.value)}
                        rows={2}
                        className="resize-y text-[11px] leading-relaxed"
                        placeholder={props.domainVerificationCodePlaceholder}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => removeDomainVerification(index)}
                        title={props.removeDomainVerificationButton}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        {props.removeDomainVerificationButton}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{props.nanoaiEmbedCodeLabel}</Label>
          <Textarea
            value={nanoaiEmbedCode}
            onChange={(e) => setNanoaiEmbedCode(e.target.value)}
            rows={4}
            className="resize-y text-[11px] leading-relaxed"
            placeholder={props.embedCodePlaceholder}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => copyText(nanoaiEmbedCode)}
            title={props.copiedToast}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {props.copyNanoaiEmbedButton}
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{props.facebookChatEmbedCodeLabel}</Label>
          <Textarea
            value={facebookChatEmbedCode}
            onChange={(e) => setFacebookChatEmbedCode(e.target.value)}
            rows={4}
            className="resize-y text-[11px] leading-relaxed"
            placeholder={props.embedCodePlaceholder}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => copyText(facebookChatEmbedCode)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {props.copyFacebookChatEmbedButton}
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{props.zaloChatEmbedCodeLabel}</Label>
          <Textarea
            value={zaloChatEmbedCode}
            onChange={(e) => setZaloChatEmbedCode(e.target.value)}
            rows={4}
            className="resize-y text-[11px] leading-relaxed"
            placeholder={props.embedCodePlaceholder}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => copyText(zaloChatEmbedCode)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {props.copyZaloChatEmbedButton}
          </Button>
        </div>

        <div className="flex justify-end border-t border-border/60 pt-2">
          <Button type="button" onClick={saveConfig} disabled={saving || loading}>
            {props.saveButtonLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

