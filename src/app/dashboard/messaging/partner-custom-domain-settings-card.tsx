'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useStepUpOtp } from '@/components/auth/step-up-otp-provider'
import { isStepUpRequiredError } from '@/lib/auth/step-up-otp-shared'
import type { PartnerCustomDomainRow } from '@/lib/db/messaging-partner-custom-domains-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  buildPartnerChatPublicUrl,
} from '@/lib/messaging/partner-public-url'
import {
  getMessagingPartnerCustomDomainSettings,
  removeMessagingPartnerCustomDomain,
  saveMessagingPartnerCustomDomainSettings,
  saveMessagingPartnerShopSsoSettings,
  updateMessagingPartnerCustomDomainUsage,
  verifyMessagingPartnerCustomDomain,
} from '@/app/dashboard/messaging/actions'
import { CheckCircle2, Copy, Globe, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

type T = Dictionary['partnerMessaging']

function statusBadge(sslStatus: PartnerCustomDomainRow['ssl_status'] | undefined, t: T) {
  if (!sslStatus || sslStatus === 'pending') {
    return {
      label: t.customDomainStatusPending,
      variant: 'secondary' as const,
      hint: t.customDomainStatusHintPending,
    }
  }
  if (sslStatus === 'dns_ok') {
    return {
      label: t.customDomainStatusDnsOk,
      variant: 'outline' as const,
      hint: t.customDomainStatusHintDnsOk,
    }
  }
  if (sslStatus === 'ssl_active') {
    return {
      label: t.customDomainStatusSslActive,
      variant: 'default' as const,
      hint: t.customDomainStatusHintSslActive,
    }
  }
  return {
    label: t.customDomainStatusError,
    variant: 'destructive' as const,
    hint: t.customDomainStatusHintError,
  }
}

export function PartnerCustomDomainSettingsCard({
  partnerId,
  partnerSlug,
  siteSlug,
  sitePublished,
  t,
  saveOkMessage,
  onDomainChanged,
  variant = 'full',
}: {
  partnerId: string
  partnerSlug: string
  siteSlug: string | null
  sitePublished: boolean
  t: T
  saveOkMessage: string
  onDomainChanged?: () => void
  variant?: 'full' | 'website'
}) {
  const { toast } = useToast()
  const { runWithStepUp } = useStepUpOtp()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [hostname, setHostname] = useState('')
  const [useForChat, setUseForChat] = useState(true)
  const [useForSite, setUseForSite] = useState(true)
  const [domain, setDomain] = useState<PartnerCustomDomainRow | null>(null)
  const [cnameTarget, setCnameTarget] = useState('nanoai.vn')
  const [lastDetail, setLastDetail] = useState('')
  const [shopLoginOrigin, setShopLoginOrigin] = useState('')
  const [shopLoginPath, setShopLoginPath] = useState('/dang-nhap')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMessagingPartnerCustomDomainSettings(partnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('domain' in res) {
        setDomain(res.domain ?? null)
        setHostname(res.domain?.hostname ?? '')
        setUseForChat(res.domain?.use_for_chat ?? true)
        setUseForSite(res.domain?.use_for_site ?? true)
        setCnameTarget(res.cnameTarget || 'nanoai.vn')
        if ('shopSso' in res && res.shopSso) {
          setShopLoginOrigin(res.shopSso.externalShopOrigin ?? '')
          setShopLoginPath(res.shopSso.externalShopLoginPath || '/dang-nhap')
        }
      }
    } finally {
      setLoading(false)
    }
  }, [partnerId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const badge = statusBadge(domain?.ssl_status, t)

  const previewOrigin = useMemo(() => {
    if (domain?.hostname?.trim()) {
      return `https://${domain.hostname.trim().toLowerCase()}`
    }
    return null
  }, [domain])

  const previewSslReady = domain?.ssl_status === 'ssl_active'

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: saveOkMessage })
    } catch {
      toast({ title: t.customDomainCopyFailed, variant: 'destructive' })
    }
  }

  const saveDomain = () => {
    startTransition(async () => {
      const res = await runWithStepUp(() =>
        saveMessagingPartnerCustomDomainSettings({
          partnerId,
          hostname,
          useForChat,
          useForSite,
        })
      )
      if ('error' in res && res.error) {
        if (isStepUpRequiredError(res)) return
        if (res.error === 'INVALID_HOSTNAME') {
          toast({ title: t.customDomainInvalidHostname, variant: 'destructive' })
          return
        }
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      if ('domain' in res && res.domain) {
        setDomain(res.domain)
        setCnameTarget(res.cnameTarget)
      }
      toast({ title: t.customDomainSavedOk })
      onDomainChanged?.()
      void load()
    })
  }

  const saveShopSso = () => {
    startTransition(async () => {
      const res = await runWithStepUp(() =>
        saveMessagingPartnerShopSsoSettings({
          partnerId,
          externalShopOrigin: shopLoginOrigin,
          externalShopLoginPath: shopLoginPath,
        })
      )
      if ('error' in res && res.error) {
        if (isStepUpRequiredError(res)) return
        if (res.error === 'INVALID_SHOP_ORIGIN') {
          toast({ title: t.shopSsoInvalidOrigin, variant: 'destructive' })
          return
        }
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      toast({ title: t.shopSsoSavedOk })
      onDomainChanged?.()
      void load()
    })
  }

  const verifyDomain = () => {
    startTransition(async () => {
      const res = await verifyMessagingPartnerCustomDomain(partnerId)
      if ('error' in res && res.error) {
        if (res.error === 'DNS_FAILED') {
          setLastDetail('detail' in res ? String(res.detail) : '')
          toast({ title: t.customDomainVerifyDnsFail, variant: 'destructive' })
          void load()
          return
        }
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      if ('domain' in res && res.domain) setDomain(res.domain)
      setLastDetail([res.dnsDetail, res.sslDetail].filter(Boolean).join(' · '))
      if (res.sslActive) {
        toast({ title: t.customDomainVerifyOk })
      } else {
        toast({ title: t.customDomainVerifySslPending })
      }
      void load()
      onDomainChanged?.()
    })
  }

  const removeDomain = () => {
    startTransition(async () => {
      const res = await runWithStepUp(() => removeMessagingPartnerCustomDomain(partnerId))
      if ('error' in res && res.error) {
        if (!isStepUpRequiredError(res)) toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      setDomain(null)
      setHostname('')
      toast({ title: t.customDomainRemovedOk })
      onDomainChanged?.()
      void load()
    })
  }

  const saveUsageFlags = (nextChat: boolean, nextSite: boolean) => {
    setUseForChat(nextChat)
    setUseForSite(nextSite)
    if (!domain) return
    startTransition(async () => {
      const res = await updateMessagingPartnerCustomDomainUsage({
        partnerId,
        useForChat: nextChat,
        useForSite: nextSite,
      })
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        void load()
        return
      }
      onDomainChanged?.()
      void load()
    })
  }

  if (loading) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          …
        </CardContent>
      </Card>
    )
  }

  const compact = variant === 'website'

  return (
    <div className="space-y-3">
      {!compact ? (
      <Card className="border-emerald-200/70 bg-emerald-50/30 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-emerald-600" aria-hidden />
            {t.customDomainGuideTitle}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed whitespace-pre-line">
            {t.customDomainGuideBody}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0 text-xs text-muted-foreground">
          <p>{t.customDomainStep1}</p>
          <p>{t.customDomainStep2.replace('{target}', cnameTarget)}</p>
          <p>{t.customDomainStep3}</p>
          <p>{t.customDomainStep4}</p>
        </CardContent>
      </Card>
      ) : null}

      <Card className={compact ? 'border-0 bg-transparent shadow-none' : 'border-border/70 shadow-sm'}>
        {!compact ? (
        <CardHeader className="px-4 py-3 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{t.customDomainSectionTitle}</CardTitle>
            {domain ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
          </div>
          <CardDescription className="text-xs">{t.customDomainSectionDesc}</CardDescription>
          {domain ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{badge.hint}</p>
          ) : null}
        </CardHeader>
        ) : (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {domain ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
        </div>
        )}
        <CardContent className={compact ? 'space-y-3 p-0' : 'space-y-3 px-4 pb-4 pt-0'}>
          <div className="space-y-2">
            <Label htmlFor="custom-domain-host">{t.customDomainHostnameLabel}</Label>
            <Input
              id="custom-domain-host"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder={t.customDomainHostnamePlaceholder}
              className="font-mono text-sm"
            />
          </div>

          {!compact ? (
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={useForChat}
                onChange={(e) => saveUsageFlags(e.target.checked, useForSite)}
                disabled={!domain || pending}
              />
              {t.customDomainUseForChat}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={useForSite}
                onChange={(e) => saveUsageFlags(useForChat, e.target.checked)}
                disabled={!domain || pending}
              />
              {t.customDomainUseForSite}
            </label>
          </div>
          ) : null}

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium">{t.customDomainCnameTitle}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.customDomainCnameHint.replace('{target}', cnameTarget)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-2 py-1 text-[11px]">
                {hostname.trim() || 'shop.example.com'} → CNAME → {cnameTarget}
              </code>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={() => void copyText(cnameTarget)}>
                <Copy className="h-3 w-3" aria-hidden />
                {t.customDomainCopyTarget}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              {t.customDomainSslTitle}
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t.customDomainSslHint}</p>
            {domain?.ssl_status === 'error' || lastDetail ? (
              <div
                className={
                  domain?.ssl_status === 'error'
                    ? 'rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2'
                    : 'rounded-md border border-border/60 bg-background/60 px-2.5 py-2'
                }
              >
                <p className="text-[10px] font-medium text-foreground">{t.customDomainLastErrorTitle}</p>
                <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                  {lastDetail || badge.hint}
                </p>
              </div>
            ) : null}
          </div>

          {previewOrigin ? (
            <div
              className={
                previewSslReady
                  ? 'rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-3 dark:bg-emerald-950/20 space-y-2'
                  : 'rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20 space-y-2'
              }
            >
              <p
                className={`flex items-center gap-1.5 text-xs font-medium ${previewSslReady ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-100'}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {previewSslReady ? t.customDomainPreviewTitle : t.customDomainPreviewPendingTitle}
              </p>
              {!previewSslReady ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t.customDomainPreviewPendingHint}</p>
              ) : null}
              {useForSite && siteSlug && sitePublished ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{t.customDomainPreviewSite}</span>
                  <code className="text-[11px]">{`${previewOrigin.replace(/\/$/, '')}/`}</code>
                  <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void copyText(`${previewOrigin.replace(/\/$/, '')}/`)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ) : null}
              {useForChat && partnerSlug ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{t.customDomainPreviewChat}</span>
                  <code className="text-[11px]">{buildPartnerChatPublicUrl(previewOrigin, partnerSlug)}</code>
                  <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void copyText(buildPartnerChatPublicUrl(previewOrigin, partnerSlug))}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!compact ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium">{t.shopSsoSectionTitle}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{t.shopSsoSectionDesc}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-sso-origin">{t.shopSsoLoginOriginLabel}</Label>
              <Input
                id="shop-sso-origin"
                value={shopLoginOrigin}
                onChange={(e) => setShopLoginOrigin(e.target.value)}
                placeholder={t.shopSsoLoginOriginPlaceholder}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-sso-login-path">{t.shopSsoLoginPathLabel}</Label>
              <Input
                id="shop-sso-login-path"
                value={shopLoginPath}
                onChange={(e) => setShopLoginPath(e.target.value)}
                placeholder={t.shopSsoLoginPathPlaceholder}
                className="font-mono text-sm"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={saveShopSso} disabled={pending}>
              {t.shopSsoSaveButton}
            </Button>
          </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveDomain} disabled={pending || !hostname.trim()}>
              {t.customDomainSaveButton}
            </Button>
            <Button type="button" variant="secondary" onClick={verifyDomain} disabled={pending || !domain}>
              {t.customDomainVerifyButton}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={verifyDomain}
              disabled={pending || !domain}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              {t.customDomainRefreshStatusButton}
            </Button>
            {domain ? (
              <Button type="button" variant="outline" onClick={removeDomain} disabled={pending}>
                {t.customDomainRemoveButton}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
