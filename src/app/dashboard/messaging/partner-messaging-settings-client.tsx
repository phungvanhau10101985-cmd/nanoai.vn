'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ComponentType, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  cancelMessagingWorkspaceDeletionSchedule,
  confirmMessagingWorkspaceDeletionWithOtp,
  createMessagingWorkspaceProfile,
  getMessagingWorkspaceGoogleSheetsSettings,
  getMessagingWorkspacePaymentSettings,
  getPartnerChannelStatus,
  listMessagingWorkspaceLogoVersions,
  listMyMessagingPartners,
  normalizeMessagingWorkspaceLogo,
  requestMessagingWorkspaceDeletionOtp,
  saveMessagingWorkspaceGoogleSheetsSettings,
  saveMessagingWorkspacePaymentSettings,
  savePartnerFacebookChannel,
  savePartnerZaloChannel,
  setMessagingWorkspaceActiveLogo,
  updateMessagingWorkspaceProfile,
  getPartnerMessagingFacebookMeta,
  savePartnerMessagingFacebookMeta,
  savePartnerMessagingGa4,
} from '@/app/dashboard/messaging/actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PartnerAiSettingsPanel } from '@/app/dashboard/messaging/partner-ai-settings-panel'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Palette,
  Plug,
  RefreshCw,
  Share2,
  Table,
  LineChart,
  Trash2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'

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

function SettingsBlock({
  id,
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  id?: string
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-6 space-y-3', className)}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div className="flex gap-3 sm:gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold leading-snug tracking-tight sm:text-lg">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="sm:pl-[3.25rem]">{children}</div>
    </section>
  )
}

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
  const [paymentDepositMode, setPaymentDepositMode] = useState<'none' | 'percent' | 'fixed_amount'>('percent')
  const [paymentDepositPercent, setPaymentDepositPercent] = useState('30')
  const [paymentDepositAmount, setPaymentDepositAmount] = useState('0')
  const [paymentRequireProof, setPaymentRequireProof] = useState(true)
  const [paymentSePayEnabled, setPaymentSePayEnabled] = useState(false)
  const [paymentSePayBankCode, setPaymentSePayBankCode] = useState('')
  const [paymentSePayAccountNumber, setPaymentSePayAccountNumber] = useState('')
  const [paymentSePayQrTemplate, setPaymentSePayQrTemplate] = useState<'compact' | 'qronly'>('compact')
  const [paymentSePayWebhookToken, setPaymentSePayWebhookToken] = useState('')
  const [paymentSePaySecretKey, setPaymentSePaySecretKey] = useState('')
  const [paymentSePayWebhookUrl, setPaymentSePayWebhookUrl] = useState('')
  const [metaPixelId, setMetaPixelId] = useState('')
  const [metaCapiToken, setMetaCapiToken] = useState('')
  const [metaCapiConfigured, setMetaCapiConfigured] = useState(false)
  const [shopGa4MeasurementId, setShopGa4MeasurementId] = useState('')
  const [gsEnabled, setGsEnabled] = useState(false)
  const [gsSpreadsheetId, setGsSpreadsheetId] = useState('')
  const [gsSheetName, setGsSheetName] = useState('Don hang')
  const [gsHasServiceAccount, setGsHasServiceAccount] = useState(false)
  const [gsServerFallback, setGsServerFallback] = useState(false)
  const [gsSyncCredentialsReady, setGsSyncCredentialsReady] = useState(false)
  const [gsServiceAccountJsonDraft, setGsServiceAccountJsonDraft] = useState('')
  const [paymentAutoSaveStatus, setPaymentAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const paymentHydratingRef = useRef(false)
  const paymentLastSavedSnapshotRef = useRef('')
  const paymentAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteOtpStep, setDeleteOtpStep] = useState<'send' | 'confirm'>('send')
  const [deleteOtpInput, setDeleteOtpInput] = useState('')

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  )

  const facebookCatalogFeedUrl = useMemo(() => {
    const s = selectedPartner?.slug?.trim()
    const k = selectedPartner?.embed_key?.trim()
    if (!s || !k) return ''
    if (typeof window === 'undefined') return ''
    const origin = window.location.origin
    return `${origin}/api/messaging/catalog/${encodeURIComponent(s)}/facebook-feed?key=${encodeURIComponent(k)}`
  }, [selectedPartner?.slug, selectedPartner?.embed_key])

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
    setMetaPixelId((cur.facebook_pixel_id ?? '').trim())
    setMetaCapiToken('')
    setShopGa4MeasurementId((cur.ga4_measurement_id ?? '').trim())
  }, [partners, selectedPartnerId])

  useEffect(() => {
    if (!selectedPartnerId) {
      setMetaCapiConfigured(false)
      return
    }
    void (async () => {
      const res = await getPartnerMessagingFacebookMeta(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('capiConfigured' in res) setMetaCapiConfigured(Boolean(res.capiConfigured))
      if ('pixelId' in res) setMetaPixelId((res.pixelId ?? '').trim())
    })()
  }, [selectedPartnerId])

  const loadPaymentSettings = useCallback(() => {
    if (!selectedPartnerId) return
    paymentHydratingRef.current = true
    void (async () => {
      try {
        const res = await getMessagingWorkspacePaymentSettings(selectedPartnerId)
        if ('error' in res && res.error) return
        if ('settings' in res && res.settings) {
          setPaymentBankName(res.settings.bank_name || '')
          setPaymentAccountNumber(res.settings.account_number || '')
          setPaymentAccountHolder(res.settings.account_holder || '')
          setPaymentNotifyEmail(res.settings.notify_email || '')
          setPaymentDepositMode(
            res.settings.default_deposit_mode === 'none'
              ? 'none'
              : res.settings.default_deposit_mode === 'fixed_amount'
                ? 'fixed_amount'
                : 'percent'
          )
          setPaymentDepositPercent(String(Math.max(0, Math.min(100, Math.round(Number(res.settings.default_deposit_percent) || 0)))))
          setPaymentDepositAmount(String(Math.max(0, Math.round(Number(res.settings.default_deposit_amount) || 0))))
          setPaymentRequireProof(res.settings.require_payment_proof !== false)
          setPaymentSePayEnabled(Boolean(res.settings.sepay_enabled))
          setPaymentSePayBankCode(res.settings.sepay_bank_code || '')
          setPaymentSePayAccountNumber(res.settings.sepay_account_number || '')
          setPaymentSePayQrTemplate(res.settings.sepay_qr_template === 'qronly' ? 'qronly' : 'compact')
          setPaymentSePayWebhookToken(res.settings.sepay_webhook_token || '')
          setPaymentSePaySecretKey(res.settings.sepay_secret_key || '')
          paymentLastSavedSnapshotRef.current = JSON.stringify({
            partnerId: selectedPartnerId,
            bankName: res.settings.bank_name || '',
            accountNumber: res.settings.account_number || '',
            accountHolder: res.settings.account_holder || '',
            notifyEmail: res.settings.notify_email || '',
            defaultDepositPercent: Math.max(0, Math.min(100, Math.round(Number(res.settings.default_deposit_percent) || 0))),
            defaultDepositMode:
              res.settings.default_deposit_mode === 'none'
                ? 'none'
                : res.settings.default_deposit_mode === 'fixed_amount'
                  ? 'fixed_amount'
                  : 'percent',
            defaultDepositAmount: Math.max(0, Math.round(Number(res.settings.default_deposit_amount) || 0)),
            requirePaymentProof: res.settings.require_payment_proof !== false,
            sepayEnabled: Boolean(res.settings.sepay_enabled),
            sepayBankCode: res.settings.sepay_bank_code || '',
            sepayAccountNumber: res.settings.sepay_account_number || '',
            sepayQrTemplate: res.settings.sepay_qr_template === 'qronly' ? 'qronly' : 'compact',
            sepayWebhookToken: res.settings.sepay_webhook_token || '',
            sepaySecretKey: res.settings.sepay_secret_key || '',
          })
          setPaymentAutoSaveStatus('idle')
        }
      } finally {
        paymentHydratingRef.current = false
      }
    })()
  }, [selectedPartnerId])

  useEffect(() => {
    loadPaymentSettings()
  }, [loadPaymentSettings])

  useEffect(() => {
    if (!selectedPartnerId) {
      setGsHasServiceAccount(false)
      setGsServerFallback(false)
      setGsSyncCredentialsReady(false)
      return
    }
    void (async () => {
      const res = await getMessagingWorkspaceGoogleSheetsSettings(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('settings' in res && res.settings) {
        setGsEnabled(Boolean(res.settings.enabled))
        setGsSpreadsheetId(res.settings.spreadsheetId ?? '')
        setGsSheetName((res.settings.sheetName ?? '').trim() || 'Don hang')
        setGsHasServiceAccount(Boolean(res.hasServiceAccount))
        setGsServerFallback(Boolean(res.serverFallbackAvailable))
        setGsSyncCredentialsReady(Boolean(res.syncCredentialsReady))
        setGsServiceAccountJsonDraft('')
      }
    })()
  }, [selectedPartnerId])

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

  const openDeleteWorkspaceDialog = () => {
    if (!selectedPartnerId || selectedPartner?.purge_at) return
    setDeleteOtpStep('send')
    setDeleteOtpInput('')
    setDeleteDialogOpen(true)
  }

  const sendDeleteOtp = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await requestMessagingWorkspaceDeletionOtp(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.deleteWorkspaceOtpSentToast })
      setDeleteOtpStep('confirm')
    })
  }

  const confirmDeleteWorkspaceWithOtp = () => {
    if (!selectedPartnerId) return
    const otp = deleteOtpInput.replace(/\D/g, '').trim()
    if (otp.length !== 6) {
      toast({ title: 'Nhap du 6 so OTP.', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const res = await confirmMessagingWorkspaceDeletionWithOtp(selectedPartnerId, otp)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('purge_at' in res && res.purge_at) {
        setPartners((prev) =>
          prev.map((p) => (p.id === selectedPartnerId ? { ...p, purge_at: res.purge_at } : p))
        )
      }
      setDeleteDialogOpen(false)
      setDeleteOtpInput('')
      toast({
        title:
          'Da len lich xoa workspace. Shop khong nhan tin khach cho den khi hoan tat hoac ban huy lich.',
      })
      router.refresh()
    })
  }

  const cancelScheduledDeletion = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await cancelMessagingWorkspaceDeletionSchedule(selectedPartnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartnerId ? { ...p, purge_at: null, deletion_requested_at: null } : p))
      )
      toast({ title: t.deleteWorkspaceScheduleCancelled })
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

  const saveMetaConsult = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await savePartnerMessagingFacebookMeta(selectedPartnerId, {
        pixelId: metaPixelId,
        capiToken: metaCapiToken,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setMetaCapiToken('')
      const snap = await getPartnerMessagingFacebookMeta(selectedPartnerId)
      if ('capiConfigured' in snap) setMetaCapiConfigured(Boolean(snap.capiConfigured))
      toast({ title: t.saveOk })
      router.refresh()
    })
  }

  const saveShopGa4 = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await savePartnerMessagingGa4(selectedPartnerId, shopGa4MeasurementId)
      if ('error' in res && res.error) {
        if (res.error === 'INVALID_GA4_ID') {
          toast({ title: t.shopGa4InvalidIdToast, variant: 'destructive' })
          return
        }
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      const nextId = shopGa4MeasurementId.trim() || null
      setPartners((prev) =>
        prev.map((p) => (p.id === selectedPartnerId ? { ...p, ga4_measurement_id: nextId } : p))
      )
      toast({ title: t.saveOk })
      router.refresh()
    })
  }

  const copyFacebookCatalogFeedUrl = useCallback(() => {
    if (!facebookCatalogFeedUrl) return
    void navigator.clipboard.writeText(facebookCatalogFeedUrl).then(() => {
      toast({ title: t.facebookCatalogFeedCopiedToast })
    })
  }, [facebookCatalogFeedUrl, t.facebookCatalogFeedCopiedToast, toast])

  const paymentSnapshot = useCallback(
    (partnerId: string) =>
      JSON.stringify({
        partnerId,
        bankName: paymentBankName,
        accountNumber: paymentAccountNumber,
        accountHolder: paymentAccountHolder,
        notifyEmail: paymentNotifyEmail,
        defaultDepositPercent: Math.max(0, Math.min(100, Math.round(Number(paymentDepositPercent) || 0))),
        defaultDepositMode: paymentDepositMode,
        defaultDepositAmount: Math.max(0, Math.round(Number(paymentDepositAmount) || 0)),
        requirePaymentProof: paymentRequireProof,
        sepayEnabled: paymentSePayEnabled,
        sepayBankCode: paymentSePayBankCode,
        sepayAccountNumber: paymentSePayAccountNumber,
        sepayQrTemplate: paymentSePayQrTemplate,
        sepayWebhookToken: paymentSePayWebhookToken,
        sepaySecretKey: paymentSePaySecretKey,
      }),
    [
      paymentAccountHolder,
      paymentAccountNumber,
      paymentBankName,
      paymentDepositAmount,
      paymentDepositMode,
      paymentDepositPercent,
      paymentNotifyEmail,
      paymentRequireProof,
      paymentSePayAccountNumber,
      paymentSePayBankCode,
      paymentSePayEnabled,
      paymentSePayQrTemplate,
      paymentSePaySecretKey,
      paymentSePayWebhookToken,
    ]
  )

  const persistPaymentSettings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selectedPartnerId) return
      const res = await saveMessagingWorkspacePaymentSettings({
        partnerId: selectedPartnerId,
        bankName: paymentBankName,
        bankBin: '',
        accountNumber: paymentAccountNumber,
        accountHolder: paymentAccountHolder,
        defaultDepositPercent: Math.max(0, Math.min(100, Math.round(Number(paymentDepositPercent) || 0))),
        defaultDepositMode: paymentDepositMode,
        defaultDepositAmount: Math.max(0, Math.round(Number(paymentDepositAmount) || 0)),
        notifyEmail: paymentNotifyEmail,
        requirePaymentProof: paymentRequireProof,
        sepayEnabled: paymentSePayEnabled,
        sepayBankCode: paymentSePayBankCode,
        sepayAccountNumber: paymentSePayAccountNumber,
        sepayQrTemplate: paymentSePayQrTemplate,
        sepayWebhookToken: paymentSePayWebhookToken,
        sepaySecretKey: paymentSePaySecretKey,
      })
      if ('error' in res && res.error) {
        setPaymentAutoSaveStatus('error')
        if (!opts?.silent) toast({ title: res.error, variant: 'destructive' })
        return
      }
      paymentLastSavedSnapshotRef.current = paymentSnapshot(selectedPartnerId)
      setPaymentAutoSaveStatus('saved')
      if (!opts?.silent) toast({ title: 'Da luu cai dat thanh toan.' })
    },
    [
      paymentAccountHolder,
      paymentAccountNumber,
      paymentBankName,
      paymentDepositAmount,
      paymentDepositMode,
      paymentDepositPercent,
      paymentNotifyEmail,
      paymentRequireProof,
      paymentSePayAccountNumber,
      paymentSePayBankCode,
      paymentSePayEnabled,
      paymentSePayQrTemplate,
      paymentSePaySecretKey,
      paymentSePayWebhookToken,
      paymentSnapshot,
      selectedPartnerId,
      toast,
    ]
  )

  const savePaymentSettings = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      await persistPaymentSettings()
    })
  }

  const saveGoogleSheetsSettings = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await saveMessagingWorkspaceGoogleSheetsSettings({
        partnerId: selectedPartnerId,
        enabled: gsEnabled,
        spreadsheetIdOrUrl: gsSpreadsheetId,
        sheetName: gsSheetName,
        ...(gsServiceAccountJsonDraft.trim()
          ? { serviceAccountJson: gsServiceAccountJsonDraft }
          : {}),
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setGsServiceAccountJsonDraft('')
      toast({ title: t.saveOk })
      router.refresh()
      const snap = await getMessagingWorkspaceGoogleSheetsSettings(selectedPartnerId)
      if ('settings' in snap && snap.settings) {
        setGsHasServiceAccount(Boolean(snap.hasServiceAccount))
        setGsServerFallback(Boolean(snap.serverFallbackAvailable))
        setGsSyncCredentialsReady(Boolean(snap.syncCredentialsReady))
      }
    })
  }

  const clearGoogleSheetsServiceAccount = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await saveMessagingWorkspaceGoogleSheetsSettings({
        partnerId: selectedPartnerId,
        enabled: gsEnabled,
        spreadsheetIdOrUrl: gsSpreadsheetId,
        sheetName: gsSheetName,
        clearServiceAccountJson: true,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      setGsServiceAccountJsonDraft('')
      toast({ title: t.saveOk })
      router.refresh()
      const snap = await getMessagingWorkspaceGoogleSheetsSettings(selectedPartnerId)
      if ('settings' in snap && snap.settings) {
        setGsHasServiceAccount(Boolean(snap.hasServiceAccount))
        setGsServerFallback(Boolean(snap.serverFallbackAvailable))
        setGsSyncCredentialsReady(Boolean(snap.syncCredentialsReady))
      }
    })
  }

  useEffect(() => {
    if (!selectedPartnerId || paymentHydratingRef.current) return
    const nextSnapshot = paymentSnapshot(selectedPartnerId)
    if (nextSnapshot === paymentLastSavedSnapshotRef.current) return
    if (paymentAutoSaveTimerRef.current) clearTimeout(paymentAutoSaveTimerRef.current)
    setPaymentAutoSaveStatus('saving')
    paymentAutoSaveTimerRef.current = setTimeout(() => {
      void persistPaymentSettings({ silent: true })
    }, 900)
    return () => {
      if (paymentAutoSaveTimerRef.current) clearTimeout(paymentAutoSaveTimerRef.current)
    }
  }, [paymentSnapshot, persistPaymentSettings, selectedPartnerId])

  useEffect(() => {
    return () => {
      if (paymentAutoSaveTimerRef.current) clearTimeout(paymentAutoSaveTimerRef.current)
    }
  }, [])

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
    <div className="mx-auto max-w-4xl space-y-6">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.deleteWorkspaceButton}</DialogTitle>
            <DialogDescription className="text-left">{t.deleteWorkspaceOtpIntro}</DialogDescription>
          </DialogHeader>
          {deleteOtpStep === 'send' ? (
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t.cancelAddWorkspace}
              </Button>
              <Button type="button" onClick={sendDeleteOtp} disabled={pending}>
                {t.deleteWorkspaceOtpSend}
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ws-del-otp-settings">
                  {t.deleteWorkspaceOtpLabel}
                </label>
                <Input
                  id="ws-del-otp-settings"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={deleteOtpInput}
                  onChange={(e) => setDeleteOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setDeleteOtpStep('send')}>
                  {t.deleteWorkspaceOtpSend}
                </Button>
                <Button type="button" variant="destructive" onClick={confirmDeleteWorkspaceWithOtp} disabled={pending}>
                  {t.deleteWorkspaceOtpConfirm}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
        <>
        <Card className="border-violet-200/80 bg-violet-50/50 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/25">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.customerCareShopSetupGuideTitle}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {t.customerCareShopSetupGuideBody}
            </p>
          </CardContent>
        </Card>
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
        </>
      ) : (
        <div
          className={cn(
            'flex flex-col',
            /* Kẻ ngang rõ: mọi mục sau mục đầu có viền trên (tránh divide-* quá nhạt / không render). */
            '[&>*+*]:border-t-2 [&>*+*]:border-solid [&>*+*]:border-neutral-400 dark:[&>*+*]:border-neutral-500',
            '[&>*]:py-4 sm:[&>*]:py-5 [&>*:first-child]:pt-0'
          )}
        >
          <SettingsBlock
            id="messaging-workspace"
            icon={Building2}
            title={t.workspaceLabel}
            description={t.cardDescription}
          >
            {selectedPartner?.purge_at ? (
              <div className="rounded-lg border border-amber-500/50 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex-1">{t.deleteWorkspaceScheduledBanner}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-amber-700/40"
                    onClick={cancelScheduledDeletion}
                    disabled={pending}
                  >
                    {t.deleteWorkspaceCancelSchedule}
                  </Button>
                </div>
              </div>
            ) : null}

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.workspaceLabel}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
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
                        {p.purge_at ? ' — chờ xóa' : ''}
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
                    onClick={openDeleteWorkspaceDialog}
                    disabled={pending || !selectedPartnerId || Boolean(selectedPartner?.purge_at)}
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
          </SettingsBlock>

          {selectedPartnerId ? (
            <SettingsBlock
              id="messaging-brand"
              icon={Palette}
              title="Thương hiệu & logo"
              description="Tên hiển thị, ngành hàng và logo dùng trên widget chat."
            >
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Chi tiết shop</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
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
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                </div>
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
            </SettingsBlock>
          ) : null}

          <SettingsBlock
            id="messaging-channels"
            icon={Share2}
            title={t.channelsSection}
            description={t.credentialsKeepHint}
          >
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Facebook &amp; Zalo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
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
          </SettingsBlock>

          <SettingsBlock
            id="messaging-meta-consult"
            icon={LineChart}
            title={t.metaConsultTrackingSection}
            description={t.metaConsultTrackingHint}
          >
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Meta Pixel &amp; CAPI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t.facebookPixelLabel}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                    placeholder={t.facebookPixelPlaceholder}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs font-medium">{t.metaConsultCapiTokenLabel}</Label>
                    {metaCapiConfigured ? (
                      <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                        {t.metaConsultCapiConfiguredBadge}
                      </span>
                    ) : null}
                  </div>
                  <Input
                    className="h-9 text-sm"
                    value={metaCapiToken}
                    onChange={(e) => setMetaCapiToken(e.target.value)}
                    placeholder={t.metaConsultCapiTokenPlaceholder}
                    type="password"
                    autoComplete="new-password"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {metaCapiConfigured ? t.metaConsultCapiSavedHint : t.credentialsKeepHint}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={saveMetaConsult} disabled={pending || !selectedPartnerId}>
                  {t.metaConsultSaveButton}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Google Analytics 4</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t.shopGa4MeasurementLabel}</Label>
                  <Input
                    className="h-9 text-sm"
                    value={shopGa4MeasurementId}
                    onChange={(e) => setShopGa4MeasurementId(e.target.value)}
                    placeholder={t.shopGa4MeasurementPlaceholder}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">{t.shopGa4MeasurementHint}</p>
                </div>
                <Button type="button" size="sm" onClick={saveShopGa4} disabled={pending || !selectedPartnerId}>
                  {t.shopGa4SaveButton}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t.facebookCatalogFeedTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t.facebookCatalogFeedHint}</p>
                {facebookCatalogFeedUrl ? (
                  <>
                    <Input readOnly className="h-9 font-mono text-[11px]" value={facebookCatalogFeedUrl} />
                    <Button type="button" size="sm" variant="outline" onClick={copyFacebookCatalogFeedUrl}>
                      {t.facebookCatalogFeedCopyButton}
                    </Button>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </SettingsBlock>

          <SettingsBlock
            id="messaging-payment"
            icon={CreditCard}
            title="Đơn hàng & thanh toán trong chat"
            description="Thông tin chuyển khoản, đặt cọc và tùy chọn SePay cho đơn tạo trong khung chat."
          >
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chuyển khoản &amp; đặt cọc</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
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
                  <Label className="text-xs font-medium">Kieu dat coc mac dinh</Label>
                  <Select
                    value={paymentDepositMode}
                    onValueChange={(v) => setPaymentDepositMode(v === 'none' || v === 'fixed_amount' ? v : 'percent')}
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Khong can dat coc</SelectItem>
                      <SelectItem value="percent">Dat coc theo % don hang</SelectItem>
                      <SelectItem value="fixed_amount">Dat coc theo so tien tuy y</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentDepositMode === 'percent' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Dat coc theo % (0-100)</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentDepositPercent}
                      onChange={(e) => setPaymentDepositPercent(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                      placeholder="Vi du: 30"
                    />
                  </div>
                ) : null}
                {paymentDepositMode === 'fixed_amount' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Dat coc so tien co dinh (VND)</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentDepositAmount}
                      onChange={(e) => setPaymentDepositAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 12))}
                      placeholder="Vi du: 200000"
                    />
                  </div>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Luu y: Tien dat coc phai nho hon hoac bang tong tien don hang. Neu vuot, he thong se fallback ve 20% gia tri don.
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={paymentRequireProof}
                  onChange={(e) => setPaymentRequireProof(e.target.checked)}
                />
                Bat buoc khach gui anh chung tu chuyen khoan de AI doi chieu
              </label>
              <div className="space-y-3 border-t border-border/60 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SePay (qr.sepay.vn)</p>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <p className="mb-2 text-xs text-muted-foreground">Tùy chọn — QR qua SePay khi đã điền đủ biến.</p>
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
                    <Label className="text-xs font-medium">So tai khoan nhan tien (cai dat tren SePay)</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentSePayAccountNumber}
                      onChange={(e) => setPaymentSePayAccountNumber(e.target.value)}
                      placeholder="Nhap so tai khoan nhan tien tren SePay"
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
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">SePay Secret Key</Label>
                    <Input
                      className="h-9 text-sm"
                      value={paymentSePaySecretKey}
                      onChange={(e) => setPaymentSePaySecretKey(e.target.value)}
                      type="password"
                      placeholder="Nhap Secret Key cua don vi SePay"
                    />
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
              </div>
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Table className="h-4 w-4 shrink-0" aria-hidden />
                    Google Sheet — đồng bộ đơn hàng
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Mỗi khi đơn được tạo/cập nhật (checkout, thanh toán, giao hàng), hệ thống ghi hoặc cập nhật một dòng trên
                    Google Sheet của shop. Tạo <strong>service account</strong> trên Google Cloud, bật <strong>Google Sheets API</strong>, tải file
                    JSON key — <strong>dán nguyên nội dung vào ô bên dưới</strong> (lưu theo từng workspace). Trong Google Sheet, bấm Share và thêm
                    email <em>client_email</em> trong JSON với quyền <strong>Editor</strong>. Không cần sửa mã nguồn ứng dụng.
                  </p>
                  {gsServerFallback ? (
                    <p className="text-[11px] text-muted-foreground rounded-md border border-border/70 bg-muted/30 px-2 py-1.5">
                      Host có thể cấu thêm fallback chung (tùy chọn); shop vẫn ưu tiên JSON đã dán ở đây.
                    </p>
                  ) : null}
                  {gsEnabled && !gsSyncCredentialsReady && !gsServiceAccountJsonDraft.trim() ? (
                    <p className="rounded-md border border-amber-300/80 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      Chưa có JSON service account cho shop này — đồng bộ sẽ không chạy. Dán file JSON vào ô «Service account
                      JSON» rồi lưu (hoặc nhờ quản trị host bật fallback).
                    </p>
                  ) : null}
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={gsEnabled}
                      onChange={(e) => setGsEnabled(e.target.checked)}
                      disabled={!selectedPartnerId}
                    />
                    Bật ghi đơn lên Google Sheet cho workspace này
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-medium">Link hoặc ID Google Sheet</Label>
                      <Input
                        className="h-9 text-sm font-mono"
                        value={gsSpreadsheetId}
                        onChange={(e) => setGsSpreadsheetId(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Tên tab (sheet)</Label>
                      <Input
                        className="h-9 text-sm"
                        value={gsSheetName}
                        onChange={(e) => setGsSheetName(e.target.value)}
                        placeholder="Don hang"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-medium">Service account JSON (Google Cloud)</Label>
                      {gsHasServiceAccount ? (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Đã lưu key</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Chưa lưu</span>
                      )}
                    </div>
                    <Textarea
                      className="min-h-[120px] font-mono text-[11px] leading-snug"
                      value={gsServiceAccountJsonDraft}
                      onChange={(e) => setGsServiceAccountJsonDraft(e.target.value)}
                      placeholder='Dán toàn bộ nội dung file .json (có "client_email", "private_key"). Để trống khi lưu = giữ key cũ.'
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={clearGoogleSheetsServiceAccount}
                        disabled={pending || !selectedPartnerId || !gsHasServiceAccount}
                      >
                        Gỡ JSON đã lưu
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={saveGoogleSheetsSettings}
                    disabled={pending || !selectedPartnerId}
                  >
                    Lưu cài đặt Google Sheet
                  </Button>
                </CardContent>
              </Card>
              <Button type="button" size="sm" onClick={savePaymentSettings} disabled={pending || !selectedPartnerId}>
                Luu cai dat thanh toan
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {paymentAutoSaveStatus === 'saving'
                  ? 'Dang tu luu cai dat thanh toan...'
                  : paymentAutoSaveStatus === 'saved'
                    ? 'Da tu luu cai dat thanh toan.'
                    : paymentAutoSaveStatus === 'error'
                      ? 'Tu luu that bai, vui long bam "Luu cai dat thanh toan".'
                      : 'Cai dat thanh toan se duoc tu dong luu.'}
              </p>
            </CardContent>
          </Card>
          </SettingsBlock>

          <SettingsBlock
            id="messaging-api"
            icon={Plug}
            title={t.messagingSettingsApiHubCardTitle}
            description={t.messagingSettingsApiHubCardBody}
          >
          <Card className="border-border/60 border-violet-500/20 bg-muted/30 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">API keys &amp; nhúng</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
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
          </SettingsBlock>

          {selectedPartnerId ? (
            <div id="messaging-ai" className="scroll-mt-6">
              <PartnerAiSettingsPanel
                key={selectedPartnerId}
                partnerId={selectedPartnerId}
                partnerChatSlug={selectedPartner?.slug?.trim() ?? ''}
                locale={locale}
                t={tAi}
                saveOkMessage={t.saveOk}
                aiModelId={partnerAiLlmModel}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
