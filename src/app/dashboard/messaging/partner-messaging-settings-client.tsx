'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
  createMessagingWorkspaceProfile,
  getMessagingWorkspacePaymentSettings,
  getPartnerChannelStatus,
  listMessagingWorkspaceLogoVersions,
  listMyMessagingPartners,
  normalizeMessagingWorkspaceLogo,
  removeMyMessagingWorkspace,
  saveMessagingWorkspacePaymentSettings,
  savePartnerFacebookChannel,
  savePartnerZaloChannel,
  setMessagingWorkspaceActiveLogo,
  updateMessagingWorkspaceProfile,
} from '@/app/dashboard/messaging/actions'
import { PartnerAiSettingsPanel } from '@/app/dashboard/messaging/partner-ai-settings-panel'
import { ArrowLeft, RefreshCw, Trash2, Upload } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'

const DELETE_WORKSPACE_CONFIRM_TOKEN = 'XOA'
const INDUSTRY_OPTIONS = [
  { value: 'fashion', label: 'Thoi trang' },
  { value: 'hotel', label: 'Khach san' },
  { value: 'food', label: 'Quan an' },
  { value: 'other', label: 'Nganh khac' },
] as const

type ChannelSnap = {
  facebookPageId: string | null
  facebookHasToken: boolean
  facebookHasVerify: boolean
  zaloConfigured: boolean
}

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type LogoVersionRow = {
  id: string
  partner_id: string
  source_logo_url: string
  normalized_logo_url: string
  model: string
  prompt: string
  status: 'done' | 'failed'
  charged_credits: number
  is_active: boolean
  created_by: string | null
  created_at: string
}
type T = Dictionary['partnerMessaging']
type TAi = Dictionary['partnerMessagingAi']

export function PartnerMessagingSettingsClient({
  initialPartners,
  locale,
  t,
  tAi,
  partnerAiLlmModel,
}: {
  initialPartners: PartnerRow[]
  locale: WebLocale
  t: T
  tAi: TAi
  partnerAiLlmModel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryPartnerId = searchParams.get('partner')
  const { toast } = useToast()
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(() => {
    if (queryPartnerId && initialPartners.some((p) => p.id === queryPartnerId)) return queryPartnerId
    return initialPartners[0]?.id ?? null
  })
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceBrandName, setWorkspaceBrandName] = useState('')
  const [workspaceIndustry, setWorkspaceIndustry] = useState<'fashion' | 'hotel' | 'food' | 'other'>('fashion')
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState('')
  const [fbPageId, setFbPageId] = useState('')
  const [fbToken, setFbToken] = useState('')
  const [fbVerify, setFbVerify] = useState('')
  const [zaloSec, setZaloSec] = useState('')
  const [zaloTok, setZaloTok] = useState('')
  const [pending, startTransition] = useTransition()
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [channelSnap, setChannelSnap] = useState<ChannelSnap | null>(null)
  const [logoVersions, setLogoVersions] = useState<LogoVersionRow[]>([])
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)
  const [paymentBankName, setPaymentBankName] = useState('')
  const [paymentAccountNumber, setPaymentAccountNumber] = useState('')
  const [paymentAccountHolder, setPaymentAccountHolder] = useState('')
  const [paymentNotifyEmail, setPaymentNotifyEmail] = useState('')
  const [paymentDepositPercent, setPaymentDepositPercent] = useState<30 | 100>(30)
  const [paymentRequireProof, setPaymentRequireProof] = useState(true)
  const [paymentSePayEnabled, setPaymentSePayEnabled] = useState(false)
  const [paymentSePayBankCode, setPaymentSePayBankCode] = useState('')
  const [paymentSePayAccountNumber, setPaymentSePayAccountNumber] = useState('')
  const [paymentSePayQrTemplate, setPaymentSePayQrTemplate] = useState<'compact' | 'qronly'>('compact')
  const [paymentSePayWebhookToken, setPaymentSePayWebhookToken] = useState('')
  const [paymentSePayWebhookUrl, setPaymentSePayWebhookUrl] = useState('')

  const setSelectedPartnerAndPersist = useCallback(
    (partnerId: string | null) => {
      setSelectedPartnerId(partnerId)
      const next = new URLSearchParams(searchParams.toString())
      if (!partnerId) {
        if (!next.has('partner')) return
        next.delete('partner')
      } else {
        const current = searchParams.get('partner')
        if (current === partnerId) return
        next.set('partner', partnerId)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (selectedPartnerId && partners.some((p) => p.id === selectedPartnerId)) return
    const fallback = queryPartnerId && partners.some((p) => p.id === queryPartnerId) ? queryPartnerId : partners[0]?.id ?? null
    if (fallback !== selectedPartnerId) setSelectedPartnerId(fallback)
  }, [partners, queryPartnerId, selectedPartnerId])

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
        if (!selectedPartnerId && next[0]) setSelectedPartnerAndPersist(next[0].id)
      }
    })
  }, [selectedPartnerId, setSelectedPartnerAndPersist, toast])

  useEffect(() => {
    setFbToken('')
    setFbVerify('')
    setZaloSec('')
    setZaloTok('')
    loadChannelStatus()
  }, [selectedPartnerId, loadChannelStatus])

  useEffect(() => {
    const cur = partners.find((p) => p.id === selectedPartnerId) ?? null
    if (!cur) return
    setWorkspaceName(cur.display_name || '')
    setWorkspaceBrandName(cur.brand_name || cur.display_name || '')
    setWorkspaceIndustry(cur.industry_key || 'fashion')
    setWorkspaceLogoUrl(cur.logo_url || '')
  }, [partners, selectedPartnerId])

  const loadPaymentSettings = useCallback(() => {
    if (!selectedPartnerId) return
    void (async () => {
      const res = await getMessagingWorkspacePaymentSettings(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('settings' in res && res.settings) {
        setPaymentBankName(res.settings.bank_name || '')
        setPaymentAccountNumber(res.settings.account_number || '')
        setPaymentAccountHolder(res.settings.account_holder || '')
        setPaymentNotifyEmail(res.settings.notify_email || '')
        setPaymentDepositPercent(res.settings.default_deposit_percent === 100 ? 100 : 30)
        setPaymentRequireProof(res.settings.require_payment_proof !== false)
        setPaymentSePayEnabled(Boolean(res.settings.sepay_enabled))
        setPaymentSePayBankCode(res.settings.sepay_bank_code || '')
        setPaymentSePayAccountNumber(res.settings.sepay_account_number || '')
        setPaymentSePayQrTemplate(res.settings.sepay_qr_template === 'qronly' ? 'qronly' : 'compact')
        setPaymentSePayWebhookToken(res.settings.sepay_webhook_token || '')
      }
    })()
  }, [selectedPartnerId])

  useEffect(() => {
    loadPaymentSettings()
  }, [loadPaymentSettings])

  useEffect(() => {
    if (!selectedPartnerId) {
      setPaymentSePayWebhookUrl('')
      return
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setPaymentSePayWebhookUrl(
      `${origin}/api/sepay-webhook?partner=${selectedPartnerId}&token=${paymentSePayWebhookToken || '<token>'}`
    )
  }, [paymentSePayWebhookToken, selectedPartnerId])

  const loadLogoVersions = useCallback(() => {
    if (!selectedPartnerId) {
      setLogoVersions([])
      return
    }
    void (async () => {
      const res = await listMessagingWorkspaceLogoVersions(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('rows' in res) setLogoVersions((res.rows ?? []) as LogoVersionRow[])
    })()
  }, [selectedPartnerId])

  useEffect(() => {
    loadLogoVersions()
  }, [loadLogoVersions])

  const createWs = () => {
    if (!workspaceName.trim() || !workspaceBrandName.trim()) return
    startTransition(async () => {
      const res = await createMessagingWorkspaceProfile({
        displayName: workspaceName.trim(),
        brandName: workspaceBrandName.trim(),
        industryKey: workspaceIndustry,
        logoUrl: workspaceLogoUrl.trim(),
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('partner' in res && res.partner) {
        setWorkspaceName('')
        setWorkspaceBrandName('')
        setWorkspaceIndustry('fashion')
        setWorkspaceLogoUrl('')
        setPartners((p) => [res.partner as PartnerRow, ...p])
        setSelectedPartnerAndPersist(res.partner.id)
        setShowAddWorkspace(false)
        toast({ title: t.saveOk })
      }
    })
  }

  const saveWorkspaceProfile = () => {
    if (!selectedPartnerId || !workspaceName.trim() || !workspaceBrandName.trim()) return
    startTransition(async () => {
      const ok = await persistWorkspaceProfile({ silent: false })
      if (!ok) return
    })
  }

  const persistWorkspaceProfile = async (opts?: { logoUrl?: string; silent?: boolean }): Promise<boolean> => {
    if (!selectedPartnerId || !workspaceName.trim() || !workspaceBrandName.trim()) return false
    const res = await updateMessagingWorkspaceProfile({
      partnerId: selectedPartnerId,
      displayName: workspaceName.trim(),
      brandName: workspaceBrandName.trim(),
      industryKey: workspaceIndustry,
      logoUrl: (opts?.logoUrl ?? workspaceLogoUrl).trim(),
    })
    if ('error' in res && res.error) {
      if (!opts?.silent) toast({ title: res.error, variant: 'destructive' })
      return false
    }
    if ('partner' in res && res.partner) {
      setPartners((prev) => prev.map((x) => (x.id === res.partner.id ? (res.partner as PartnerRow) : x)))
      setWorkspaceLogoUrl((res.partner as PartnerRow).logo_url ?? '')
      if (!opts?.silent) toast({ title: t.saveOk })
      return true
    }
    return false
  }

  const uploadLogoFile = async (file: File) => {
    if (!selectedPartnerId) return
    if (!file || file.size <= 0) return
    const isImage = /^image\//i.test(file.type || '')
    if (!isImage) {
      toast({ title: 'Chi chap nhan file anh.', variant: 'destructive' })
      return
    }
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.set('partnerId', selectedPartnerId)
      fd.set('file', file)
      const res = await fetch('/api/messaging/partner/image', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      })
      const data = (await res.json().catch(() => null)) as { publicUrl?: string; error?: string } | null
      if (!res.ok || !data?.publicUrl) {
        toast({ title: data?.error || 'Upload logo that bai.', variant: 'destructive' })
        return
      }
      setWorkspaceLogoUrl(data.publicUrl)
      startTransition(async () => {
        const ok = await persistWorkspaceProfile({ logoUrl: data.publicUrl, silent: true })
        if (ok) toast({ title: 'Da tai len va luu logo cho shop.' })
        else toast({ title: 'Da tai logo nhung chua luu duoc vao shop.', variant: 'destructive' })
      })
    } catch {
      toast({ title: 'Upload logo that bai.', variant: 'destructive' })
    } finally {
      setLogoUploading(false)
    }
  }

  const autoSaveLogoUrl = () => {
    if (!selectedPartnerId) return
    const logo = workspaceLogoUrl.trim()
    if (!logo) return
    startTransition(async () => {
      await persistWorkspaceProfile({ logoUrl: logo, silent: true })
    })
  }

  const normalizeLogo = () => {
    if (!selectedPartnerId) return
    const source = workspaceLogoUrl.trim()
    if (!source) {
      toast({ title: 'Nhap logo URL truoc khi chuan hoa.', variant: 'destructive' })
      return
    }
    if (!window.confirm('Chuan hoa logo se tru 1.5 credits. Ban co dong y?')) return
    setLogoBusy(true)
    startTransition(async () => {
      const res = await normalizeMessagingWorkspaceLogo({
        partnerId: selectedPartnerId,
        sourceLogoUrl: source,
        brandName: workspaceBrandName.trim() || workspaceName.trim(),
        mode: 'standard',
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        setLogoBusy(false)
        return
      }
      if ('ok' in res && res.ok) {
        toast({
          title: `Da chuan hoa logo (-${res.deductedCredits} credits). Con lai ${res.creditsRemaining}.`,
        })
        await loadLogoVersions()
      }
      setLogoBusy(false)
    })
  }

  const normalizeLogoImpressive = () => {
    if (!selectedPartnerId) return
    const source = workspaceLogoUrl.trim()
    if (!source) {
      toast({ title: 'Nhap logo URL truoc khi chuan hoa.', variant: 'destructive' })
      return
    }
    if (!window.confirm('Chuan hoa logo an tuong se tru 1.5 credits. Ban co dong y?')) return
    setLogoBusy(true)
    startTransition(async () => {
      const res = await normalizeMessagingWorkspaceLogo({
        partnerId: selectedPartnerId,
        sourceLogoUrl: source,
        brandName: workspaceBrandName.trim() || workspaceName.trim(),
        mode: 'impressive',
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        setLogoBusy(false)
        return
      }
      if ('ok' in res && res.ok) {
        toast({
          title: `Da chuan hoa logo (-${res.deductedCredits} credits). Con lai ${res.creditsRemaining}.`,
        })
        await loadLogoVersions()
      }
      setLogoBusy(false)
    })
  }

  const applyLogoVersion = (versionId: string) => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await setMessagingWorkspaceActiveLogo(selectedPartnerId, versionId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      await refreshPartners()
      await loadLogoVersions()
      toast({ title: 'Da chon logo dang su dung.' })
    })
  }

  const removeWs = () => {
    if (!selectedPartnerId) return
    const confirmation = window.prompt(t.deleteWorkspaceConfirm, '')
    if (confirmation === null) return
    if (confirmation.trim().toUpperCase() !== DELETE_WORKSPACE_CONFIRM_TOKEN) {
      toast({ title: `Xac nhan khong dung (${DELETE_WORKSPACE_CONFIRM_TOKEN}).`, variant: 'destructive' })
      return
    }
    const removingId = selectedPartnerId
    startTransition(async () => {
      const res = await removeMyMessagingWorkspace(removingId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setPartners((prev) => {
        const next = prev.filter((p) => p.id !== removingId)
        const fallback = next[0]?.id ?? null
        setSelectedPartnerAndPersist(fallback)
        return next
      })
      setShowAddWorkspace(false)
      toast({ title: t.deleteWorkspaceSuccess })
      router.refresh()
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

  const savePaymentSettings = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await saveMessagingWorkspacePaymentSettings({
        partnerId: selectedPartnerId,
        bankName: paymentBankName,
        bankBin: '',
        accountNumber: paymentAccountNumber,
        accountHolder: paymentAccountHolder,
        defaultDepositPercent: paymentDepositPercent,
        notifyEmail: paymentNotifyEmail,
        requirePaymentProof: paymentRequireProof,
        sepayEnabled: paymentSePayEnabled,
        sepayBankCode: paymentSePayBankCode,
        sepayAccountNumber: paymentSePayAccountNumber,
        sepayQrTemplate: paymentSePayQrTemplate,
        sepayWebhookToken: paymentSePayWebhookToken,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Da luu cai dat thanh toan.' })
      loadPaymentSettings()
    })
  }

  const copySePayWebhookUrl = async () => {
    if (!paymentSePayWebhookUrl) return
    try {
      await navigator.clipboard.writeText(paymentSePayWebhookUrl)
      toast({ title: 'Đã copy webhook URL.' })
    } catch {
      toast({ title: 'Không copy được webhook URL.', variant: 'destructive' })
    }
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
            <div className="space-y-2">
              <Label htmlFor="ws-brand-settings">Ten thuong hieu</Label>
              <Input
                id="ws-brand-settings"
                value={workspaceBrandName}
                onChange={(e) => setWorkspaceBrandName(e.target.value)}
                placeholder="Ten thuong hieu"
              />
            </div>
            <div className="space-y-2">
              <Label>Nganh hang</Label>
              <Select value={workspaceIndustry} onValueChange={(v) => setWorkspaceIndustry(v as typeof workspaceIndustry)}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder="Nganh hang" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-logo-settings">Logo URL</Label>
              <Input
                id="ws-logo-settings"
                value={workspaceLogoUrl}
                onChange={(e) => setWorkspaceLogoUrl(e.target.value)}
                onBlur={autoSaveLogoUrl}
                placeholder="https://..."
              />
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {logoUploading ? 'Dang tai logo...' : 'Upload anh logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading || !selectedPartnerId}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.currentTarget.value = ''
                      if (f) void uploadLogoFile(f)
                    }}
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">Nhap link hoac upload file anh deu duoc.</p>
              </div>
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
                onValueChange={(v) => setSelectedPartnerAndPersist(v)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue placeholder={t.workspaceLabel} />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name} ({p.industry_key || 'fashion'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddWorkspace((v) => !v)}>
                  {t.addAnotherWorkspace}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={removeWs}
                  disabled={pending || !selectedPartnerId}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t.deleteWorkspaceButton}
                </Button>
              </div>
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
                <div className="space-y-2">
                  <Label htmlFor="ws-brand-extra">Ten thuong hieu</Label>
                  <Input
                    id="ws-brand-extra"
                    value={workspaceBrandName}
                    onChange={(e) => setWorkspaceBrandName(e.target.value)}
                    placeholder="Ten thuong hieu"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nganh hang</Label>
                  <Select value={workspaceIndustry} onValueChange={(v) => setWorkspaceIndustry(v as typeof workspaceIndustry)}>
                    <SelectTrigger className="h-10 w-full bg-background">
                      <SelectValue placeholder="Nganh hang" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map((it) => (
                        <SelectItem key={it.value} value={it.value}>
                          {it.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-logo-extra">Logo URL</Label>
                  <Input
                    id="ws-logo-extra"
                    value={workspaceLogoUrl}
                    onChange={(e) => setWorkspaceLogoUrl(e.target.value)}
                    onBlur={autoSaveLogoUrl}
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      {logoUploading ? 'Dang tai logo...' : 'Upload anh logo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={logoUploading || !selectedPartnerId}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.currentTarget.value = ''
                          if (f) void uploadLogoFile(f)
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground">Nhap link hoac upload file anh deu duoc.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={createWs} disabled={pending || !workspaceName.trim() || !workspaceBrandName.trim()}>
                    {t.createButton}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddWorkspace(false)}>
                    {t.cancelAddWorkspace}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {selectedPartnerId ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Thong tin thuong hieu & nganh hang</CardTitle>
                <CardDescription className="text-xs">Shop cu chua co nganh hang co the chon lai tai day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ws-name-main">{t.workspaceNameLabel}</Label>
                    <Input
                      id="ws-name-main"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder={t.workspaceNameLabel}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-brand-main">Ten thuong hieu</Label>
                    <Input
                      id="ws-brand-main"
                      value={workspaceBrandName}
                      onChange={(e) => setWorkspaceBrandName(e.target.value)}
                      placeholder="Ten thuong hieu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nganh hang</Label>
                    <Select value={workspaceIndustry} onValueChange={(v) => setWorkspaceIndustry(v as typeof workspaceIndustry)}>
                      <SelectTrigger className="h-10 w-full bg-background">
                        <SelectValue placeholder="Nganh hang" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRY_OPTIONS.map((it) => (
                          <SelectItem key={it.value} value={it.value}>
                            {it.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ws-logo-main">Logo URL</Label>
                    <Input
                      id="ws-logo-main"
                      value={workspaceLogoUrl}
                      onChange={(e) => setWorkspaceLogoUrl(e.target.value)}
                      onBlur={autoSaveLogoUrl}
                      placeholder="https://..."
                    />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                        <Upload className="h-3.5 w-3.5" aria-hidden />
                        {logoUploading ? 'Dang tai logo...' : 'Upload anh logo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={logoUploading || !selectedPartnerId}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.currentTarget.value = ''
                            if (f) void uploadLogoFile(f)
                          }}
                        />
                      </label>
                      <p className="text-[11px] text-muted-foreground">Nhap link hoac upload file anh deu duoc.</p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={saveWorkspaceProfile}
                  disabled={pending || !selectedPartnerId || !workspaceName.trim() || !workspaceBrandName.trim()}
                >
                  Luu thong tin shop
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={normalizeLogo}
                  disabled={pending || logoBusy || !selectedPartnerId || !workspaceLogoUrl.trim()}
                >
                  {logoBusy ? 'Dang chuan hoa logo...' : 'Chuan hoa logo (1.5 credits)'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={normalizeLogoImpressive}
                  disabled={pending || logoBusy || !selectedPartnerId || !workspaceLogoUrl.trim()}
                >
                  {logoBusy ? 'Dang chuan hoa logo...' : 'Chuan hoa logo an tuong (1.5 credits)'}
                </Button>
                {logoVersions.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-border/70 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Cac phien ban logo da tao</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {logoVersions.map((lv) => (
                        <div key={lv.id} className="rounded border p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={lv.normalized_logo_url}
                            alt=""
                            className="h-14 w-14 rounded border object-contain bg-white"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {lv.is_active ? 'Dang su dung' : `Phi ${lv.charged_credits} credits`}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-1 h-7 px-2 text-[11px]"
                            variant={lv.is_active ? 'outline' : 'default'}
                            disabled={pending || lv.is_active}
                            onClick={() => applyLogoVersion(lv.id)}
                          >
                            {lv.is_active ? 'Dang su dung' : 'Dung logo nay'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cai dat don hang & thanh toan chat</CardTitle>
              <CardDescription className="text-xs">
                Cau hinh thong tin nhan coc qua QR cho don hang tao truc tiep trong khung chat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Ngan hang</Label>
                  <Input className="h-9 text-sm" value={paymentBankName} onChange={(e) => setPaymentBankName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">So tai khoan nhan tien</Label>
                  <Input
                    className="h-9 text-sm"
                    value={paymentAccountNumber}
                    onChange={(e) => setPaymentAccountNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Chu tai khoan</Label>
                  <Input className="h-9 text-sm" value={paymentAccountHolder} onChange={(e) => setPaymentAccountHolder(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Email nhan thong bao don moi</Label>
                  <Input className="h-9 text-sm" value={paymentNotifyEmail} onChange={(e) => setPaymentNotifyEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Ty le dat coc mac dinh</Label>
                  <Select
                    value={String(paymentDepositPercent)}
                    onValueChange={(v) => setPaymentDepositPercent(v === '100' ? 100 : 30)}
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30%</SelectItem>
                      <SelectItem value="100">100%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={paymentRequireProof}
                  onChange={(e) => setPaymentRequireProof(e.target.checked)}
                />
                Bat buoc khach gui anh chung tu chuyen khoan de AI doi chieu
              </label>
              <div className="rounded-md border border-border/70 p-3">
                <p className="mb-2 text-xs font-semibold">Tuy chon SePay (qr.sepay.vn)</p>
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={paymentSePayEnabled}
                    onChange={(e) => setPaymentSePayEnabled(e.target.checked)}
                  />
                  Uu tien tao QR theo SePay neu shop da dien du bien
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">SePay bank code</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentSePayBankCode}
                      onChange={(e) => setPaymentSePayBankCode(e.target.value)}
                      placeholder="MBBank / ACB / ..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">SePay account number</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentSePayAccountNumber}
                      onChange={(e) => setPaymentSePayAccountNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">SePay QR template</Label>
                    <Select
                      value={paymentSePayQrTemplate}
                      onValueChange={(v) => setPaymentSePayQrTemplate(v === 'qronly' ? 'qronly' : 'compact')}
                    >
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compact">compact</SelectItem>
                        <SelectItem value="qronly">qronly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Webhook token (shop)</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentSePayWebhookToken}
                      readOnly
                    />
                    <p className="text-[11px] text-muted-foreground">Token duoc tao tu dong theo tung shop va khong cho sua tay.</p>
                  </div>
                </div>
                {paymentSePayEnabled &&
                (!paymentSePayBankCode.trim() || !paymentSePayAccountNumber.trim() || !paymentSePayWebhookToken.trim()) ? (
                  <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    SePay đang bật nhưng thiếu biến bắt buộc (bank code / account / webhook token). Hệ thống sẽ fallback về QR thường.
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground break-all">
                  Webhook URL cho shop:
                  {selectedPartnerId ? ` ${paymentSePayWebhookUrl}` : ' (chon workspace)'}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={copySePayWebhookUrl} disabled={!selectedPartnerId}>
                  Copy webhook URL
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Neu thieu bien SePay, he thong tu dong fallback ve QR thuong hien tai.
                </p>
              </div>
              <Button type="button" size="sm" onClick={savePaymentSettings} disabled={pending || !selectedPartnerId}>
                Luu cai dat thanh toan
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 border-violet-500/20 bg-muted/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{t.messagingSettingsApiHubCardTitle}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">{t.messagingSettingsApiHubCardBody}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button type="button" variant="default" size="sm" asChild>
                <Link
                  href={
                    selectedPartnerId
                      ? `/dashboard/api-integration?partner=${selectedPartnerId}#partner-api-keys`
                      : '/dashboard/api-integration#partner-api-keys'
                  }
                >
                  {t.apiIntegrationGuideLink}
                </Link>
              </Button>
              <p className="w-full text-[11px] text-muted-foreground">{t.apiIntegrationGuideShort}</p>
            </CardContent>
          </Card>

          {selectedPartnerId ? (
            <PartnerAiSettingsPanel
              key={selectedPartnerId}
              partnerId={selectedPartnerId}
              locale={locale}
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
