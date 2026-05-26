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
import type { MessagingPartnerDashboardRow } from '@/lib/db/messaging-partners-pg'
import type { PartnerMemberRow } from '@/lib/db/messaging-partner-members-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PartnerStaffPermKey, PartnerStaffPermissionMap } from '@/lib/messaging/partner-staff-permissions'
import { PARTNER_STAFF_PERM_KEYS } from '@/lib/messaging/partner-staff-permissions'
import type { Database } from '@/types/database.types'
import {
  cancelMessagingWorkspaceDeletionSchedule,
  confirmMessagingWorkspaceDeletionWithOtp,
  createMessagingWorkspaceProfile,
  getMessagingWorkspaceGoogleSheetsSettings,
  getMessagingWorkspaceLoyaltySettings,
  getMessagingWorkspacePaymentSettings,
  getPartnerChannelStatus,
  listMessagingWorkspaceLogoVersions,
  listMyMessagingPartners,
  inviteMessagingPartnerStaffByEmail,
  listMessagingPartnerStaffForOwner,
  normalizeMessagingWorkspaceLogo,
  removeMessagingPartnerStaffMember,
  requestMessagingWorkspaceDeletionOtp,
  saveMessagingWorkspaceGoogleSheetsSettings,
  saveMessagingWorkspaceLoyaltySettings,
  saveMessagingWorkspacePaymentSettings,
  savePartnerFacebookChannel,
  savePartnerZaloChannel,
  setMessagingWorkspaceActiveLogo,
  updateMessagingPartnerStaffMemberPermissions,
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
  Trophy,
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

type LoyaltyTierDraft = {
  id?: string | null
  tierCode: string
  tierName: string
  minSpend6Months: string
  discountPercent: string
  sortOrder: number
  isActive: boolean
}

type MessagingPartnerDbRow = Database['public']['Tables']['messaging_partners']['Row']

function withOwnerDashboardAccess(row: MessagingPartnerDbRow): MessagingPartnerDashboardRow {
  return { ...row, dashboard_access: 'owner', staff_permissions: null }
}

function partnerAllowsPerm(p: MessagingPartnerDashboardRow | null | undefined, k: PartnerStaffPermKey): boolean {
  if (!p) return false
  if (p.dashboard_access === 'owner') return true
  return Boolean(p.staff_permissions?.[k])
}

function partnerCanAiPanel(p: MessagingPartnerDashboardRow | null | undefined): boolean {
  if (!p) return false
  if (p.dashboard_access === 'owner') return true
  return Boolean(p.staff_permissions?.ai_settings || p.staff_permissions?.inventory)
}
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
  appOrigin,
}: {
  initialPartners: MessagingPartnerDashboardRow[]
  locale: WebLocale
  t: T
  tAi: TAi
  partnerAiLlmModel: string
  /** Request origin from the server page — used for absolute URLs so SSR matches hydration. */
  appOrigin: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryPartnerId = searchParams.get('partner')
  const { toast } = useToast()
  const [partners, setPartners] = useState<MessagingPartnerDashboardRow[]>(initialPartners)
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
  const [fbPendingPages, setFbPendingPages] = useState<Array<{ id: string; name: string }>>([])
  const [fbPendingSelectedPageId, setFbPendingSelectedPageId] = useState('')
  const [fbPagePickerOpen, setFbPagePickerOpen] = useState(false)
  const [fbPagePicking, setFbPagePicking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [messagingIconHint, setMessagingIconHint] = useState('')
  const [messagingIconRefUrl, setMessagingIconRefUrl] = useState('')
  const [messagingIconRefUploading, setMessagingIconRefUploading] = useState(false)
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
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true)
  const [loyaltySpendWindowDays, setLoyaltySpendWindowDays] = useState('180')
  const [loyaltyMaxTotalDiscountPercent, setLoyaltyMaxTotalDiscountPercent] = useState('30')
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTierDraft[]>([])
  const [loyaltyLoading, setLoyaltyLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteOtpStep, setDeleteOtpStep] = useState<'send' | 'confirm'>('send')
  const [deleteOtpInput, setDeleteOtpInput] = useState('')
  const [staffInviteEmail, setStaffInviteEmail] = useState('')
  const [staffRows, setStaffRows] = useState<PartnerMemberRow[]>([])
  const [staffDraftPerm, setStaffDraftPerm] = useState<Record<string, PartnerStaffPermissionMap>>({})

  const selectedPartner = useMemo(
    () => partners.find((p) => p.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  )
  const isOwnerSelected = selectedPartner?.dashboard_access === 'owner'
  const facebookConnectHref = useMemo(() => {
    if (!selectedPartnerId) return '#'
    return `/api/integrations/facebook/messenger/connect?partnerId=${encodeURIComponent(selectedPartnerId)}`
  }, [selectedPartnerId])

  const facebookCatalogFeedUrl = useMemo(() => {
    const s = selectedPartner?.slug?.trim()
    const k = selectedPartner?.embed_key?.trim()
    if (!s || !k || !appOrigin.trim()) return ''
    const origin = appOrigin.replace(/\/$/, '')
    return `${origin}/api/messaging/catalog/${encodeURIComponent(s)}/facebook-feed?key=${encodeURIComponent(k)}`
  }, [appOrigin, selectedPartner?.slug, selectedPartner?.embed_key])

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

  const loadFacebookPendingPages = useCallback(async (partnerId: string) => {
    const res = await fetch(
      `/api/integrations/facebook/messenger/pending-pages?partnerId=${encodeURIComponent(partnerId)}`,
      {
        method: 'GET',
        credentials: 'same-origin',
      }
    )
    const data = (await res.json().catch(() => null)) as { pages?: Array<{ id: string; name: string }> } | null
    const pages = Array.isArray(data?.pages) ? data.pages : []
    setFbPendingPages(pages)
    setFbPendingSelectedPageId(pages[0]?.id ?? '')
    setFbPagePickerOpen(pages.length > 0)
    return pages.length
  }, [])

  useEffect(() => {
    const status = searchParams.get('fb_oauth')
    if (!status) return
    const cur = partners.find((p) => p.id === selectedPartnerId) ?? null
    if (!partnerAllowsPerm(cur, 'integrations_channels')) {
      const next = new URLSearchParams(searchParams.toString())
      next.delete('fb_oauth')
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      return
    }
    const statusText: Record<string, { title: string; destructive?: boolean }> = {
      ok: { title: 'Da ket noi Facebook Page thanh cong.' },
      'subscribed-warn': { title: 'Da luu Page token, nhung subscribe webhook chua thanh cong.' },
      'missing-config': { title: 'Thieu cau hinh Facebook OAuth tren server.', destructive: true },
      'missing-code': { title: 'Facebook khong tra ma uy quyen.', destructive: true },
      'invalid-state': { title: 'Phien uy quyen het han hoac khong hop le.', destructive: true },
      'invalid-partner': { title: 'Workspace khong hop le.', destructive: true },
      unauthorized: { title: 'Vui long dang nhap lai.', destructive: true },
      forbidden: { title: 'Ban khong co quyen ket noi workspace nay.', destructive: true },
      'exchange-failed': { title: 'Khong doi duoc access token tu Facebook.', destructive: true },
      'no-page-access': { title: 'Tai khoan nay chua co quyen tren Facebook Page nao.', destructive: true },
      'save-failed': { title: 'Khong luu duoc kenh Facebook vao he thong.', destructive: true },
      'pick-page': { title: 'Chon Facebook Page de hoan tat ket noi.' },
    }
    const mapped = statusText[status] || { title: 'Ket noi Facebook that bai.', destructive: true }
    toast({ title: mapped.title, variant: mapped.destructive ? 'destructive' : undefined })
    if (status === 'pick-page' && selectedPartnerId) {
      void loadFacebookPendingPages(selectedPartnerId)
    } else if (!mapped.destructive) {
      loadChannelStatus()
    }
    const next = new URLSearchParams(searchParams.toString())
    next.delete('fb_oauth')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [loadChannelStatus, loadFacebookPendingPages, partners, pathname, router, searchParams, selectedPartnerId, toast])

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

  const loadStaffRowsForOwner = useCallback(async (partnerId: string) => {
    const res = await listMessagingPartnerStaffForOwner(partnerId)
    if ('error' in res && res.error) return
    const rows = 'rows' in res ? (res.rows ?? []) : []
    setStaffRows(rows)
    const d: Record<string, PartnerStaffPermissionMap> = {}
    for (const r of rows) d[r.member_user_id] = { ...r.permissions }
    setStaffDraftPerm(d)
  }, [])

  useEffect(() => {
    if (!selectedPartnerId) {
      setStaffRows([])
      setStaffDraftPerm({})
      setStaffInviteEmail('')
      return
    }
    const p = partners.find((x) => x.id === selectedPartnerId)
    if (!p || p.dashboard_access !== 'owner') {
      setStaffRows([])
      setStaffDraftPerm({})
      return
    }
    void loadStaffRowsForOwner(selectedPartnerId)
  }, [selectedPartnerId, partners, loadStaffRowsForOwner])

  useEffect(() => {
    setFbToken('')
    setFbVerify('')
    setZaloSec('')
    setZaloTok('')
    const cur = partners.find((p) => p.id === selectedPartnerId) ?? null
    if (!partnerAllowsPerm(cur, 'integrations_channels')) {
      setChannelSnap(null)
      return
    }
    loadChannelStatus()
  }, [selectedPartnerId, loadChannelStatus, partners])

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
    const cur = partners.find((p) => p.id === selectedPartnerId) ?? null
    if (!partnerAllowsPerm(cur, 'integrations_analytics')) {
      setMetaCapiConfigured(false)
      return
    }
    void (async () => {
      const res = await getPartnerMessagingFacebookMeta(selectedPartnerId)
      if ('error' in res && res.error) return
      if ('capiConfigured' in res) setMetaCapiConfigured(Boolean(res.capiConfigured))
      if ('pixelId' in res) setMetaPixelId((res.pixelId ?? '').trim())
    })()
  }, [selectedPartnerId, partners])

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
    if (!selectedPartnerId) return
    const p = partners.find((x) => x.id === selectedPartnerId)
    if (!p || p.dashboard_access !== 'owner') return
    loadPaymentSettings()
  }, [loadPaymentSettings, partners, selectedPartnerId])

  useEffect(() => {
    if (!selectedPartnerId) {
      setLoyaltyTiers([])
      return
    }
    const p = partners.find((x) => x.id === selectedPartnerId)
    if (!p || p.dashboard_access !== 'owner') {
      setLoyaltyTiers([])
      return
    }
    setLoyaltyLoading(true)
    void (async () => {
      try {
        const res = await getMessagingWorkspaceLoyaltySettings(selectedPartnerId)
        if ('error' in res && res.error) return
        if ('settings' in res && 'tiers' in res) {
          setLoyaltyEnabled(res.settings.enabled !== false)
          setLoyaltySpendWindowDays(String(res.settings.spend_window_days || 180))
          setLoyaltyMaxTotalDiscountPercent(String(res.settings.max_total_discount_percent || 30))
          setLoyaltyTiers(
            res.tiers.map((tier) => ({
              id: tier.id,
              tierCode: tier.tier_code,
              tierName: tier.tier_name,
              minSpend6Months: String(Math.max(0, Math.round(Number(tier.min_spend_6_months) || 0))),
              discountPercent: String(Math.max(0, Number(tier.discount_percent) || 0)),
              sortOrder: Math.max(0, Math.floor(Number(tier.sort_order) || 0)),
              isActive: tier.is_active !== false,
            }))
          )
        }
      } finally {
        setLoyaltyLoading(false)
      }
    })()
  }, [selectedPartnerId, partners])

  useEffect(() => {
    if (!selectedPartnerId) {
      setGsHasServiceAccount(false)
      setGsServerFallback(false)
      setGsSyncCredentialsReady(false)
      return
    }
    const p = partners.find((x) => x.id === selectedPartnerId)
    if (!p || p.dashboard_access !== 'owner') {
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
  }, [selectedPartnerId, partners])

  useEffect(() => {
    if (!selectedPartnerId) {
      setPaymentSePayWebhookUrl('')
      return
    }
    const po = partners.find((x) => x.id === selectedPartnerId)
    if (!po || po.dashboard_access !== 'owner') {
      setPaymentSePayWebhookUrl('')
      return
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setPaymentSePayWebhookUrl(
      `${origin}/api/sepay-webhook?partner=${selectedPartnerId}&token=${paymentSePayWebhookToken || '<token>'}`
    )
  }, [paymentSePayWebhookToken, partners, selectedPartnerId])

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
    if (!selectedPartnerId) {
      setLogoVersions([])
      return
    }
    const p = partners.find((x) => x.id === selectedPartnerId)
    if (!partnerAllowsPerm(p ?? null, 'workspace_branding')) {
      setLogoVersions([])
      return
    }
    loadLogoVersions()
  }, [loadLogoVersions, partners, selectedPartnerId])

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
        setPartners((p) => [withOwnerDashboardAccess(res.partner as MessagingPartnerDbRow), ...p])
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
      const base = res.partner as MessagingPartnerDbRow
      setPartners((prev) =>
        prev.map((x) =>
          x.id === base.id ? { ...base, dashboard_access: x.dashboard_access, staff_permissions: x.staff_permissions } : x
        )
      )
      setWorkspaceLogoUrl(base.logo_url ?? '')
      if (!opts?.silent) toast({ title: t.saveOk })
      return true
    }
    return false
  }

  const staffPermCheckboxLabel = (k: PartnerStaffPermKey): string => {
    switch (k) {
      case 'inbox':
        return t.teamPermInbox
      case 'orders':
        return t.teamPermOrders
      case 'inventory':
        return t.teamPermInventory
      case 'ai_settings':
        return t.teamPermAiSettings
      case 'workspace_branding':
        return t.teamPermWorkspaceBranding
      case 'workspace_payment':
        return t.teamPermWorkspacePayment
      case 'integrations_channels':
        return t.teamPermIntegrationsChannels
      case 'integrations_analytics':
        return t.teamPermIntegrationsAnalytics
      case 'usage_reports':
        return t.teamPermUsageReports
      default:
        return k
    }
  }

  const inviteStaffByEmailAction = () => {
    if (!selectedPartnerId || !isOwnerSelected || !staffInviteEmail.trim()) return
    startTransition(async () => {
      const res = await inviteMessagingPartnerStaffByEmail(selectedPartnerId, staffInviteEmail.trim())
      if ('error' in res && res.error) {
        const e = res.error
        if (e === 'INVALID_EMAIL') toast({ title: t.teamInviteErrorBadEmail, variant: 'destructive' })
        else if (e === 'USER_NOT_FOUND') toast({ title: t.teamInviteErrorNotFound, variant: 'destructive' })
        else if (e === 'INVITE_OWNER' || e === 'INVITE_OWNER_ACCOUNT')
          toast({ title: t.teamInviteErrorOwner, variant: 'destructive' })
        else toast({ title: String(e), variant: 'destructive' })
        return
      }
      toast({ title: t.teamInviteOk })
      setStaffInviteEmail('')
      await loadStaffRowsForOwner(selectedPartnerId)
    })
  }

  const saveStaffPermissionsForMember = (memberUserId: string) => {
    if (!selectedPartnerId || !isOwnerSelected) return
    const draft = staffDraftPerm[memberUserId]
    if (!draft) return
    startTransition(async () => {
      const res = await updateMessagingPartnerStaffMemberPermissions({
        partnerId: selectedPartnerId,
        memberUserId,
        permissions: draft,
      })
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      toast({ title: t.saveOk })
      await loadStaffRowsForOwner(selectedPartnerId)
    })
  }

  const removeStaffMember = (memberUserId: string) => {
    if (!selectedPartnerId || !isOwnerSelected) return
    if (typeof window !== 'undefined' && !window.confirm(t.teamRemoveMemberConfirm)) return
    startTransition(async () => {
      const res = await removeMessagingPartnerStaffMember(selectedPartnerId, memberUserId)
      if ('error' in res && res.error) {
        toast({ title: String(res.error), variant: 'destructive' })
        return
      }
      toast({ title: t.saveOk })
      await loadStaffRowsForOwner(selectedPartnerId)
    })
  }

  const toggleStaffDraftPerm = (memberUserId: string, key: PartnerStaffPermKey, value: boolean) => {
    setStaffDraftPerm((prev) => {
      const cur =
        prev[memberUserId] ?? staffRows.find((r) => r.member_user_id === memberUserId)?.permissions ?? null
      if (!cur) return prev
      return { ...prev, [memberUserId]: { ...cur, [key]: value } }
    })
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

  const uploadIconRefFile = async (file: File) => {
    if (!selectedPartnerId) return
    if (!file || file.size <= 0) return
    const isImage = /^image\//i.test(file.type || '')
    if (!isImage) {
      toast({ title: 'Chi chap nhan file anh.', variant: 'destructive' })
      return
    }
    setMessagingIconRefUploading(true)
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
        toast({ title: data?.error || 'Upload anh tham chieu that bai.', variant: 'destructive' })
        return
      }
      setMessagingIconRefUrl(data.publicUrl)
      toast({ title: 'Da tai anh logo tham chieu.' })
    } catch {
      toast({ title: 'Upload anh tham chieu that bai.', variant: 'destructive' })
    } finally {
      setMessagingIconRefUploading(false)
    }
  }

  const createMessagingIcon = () => {
    if (!selectedPartnerId) return
    const hint = messagingIconHint.trim()
    const source = messagingIconRefUrl.trim()
    if (!hint && !source) {
      toast({
        title: 'Can nhap goi y text hoac anh logo tham chieu — it nhat mot trong hai.',
        variant: 'destructive',
      })
      return
    }
    const confirmMsg =
      hint && source
        ? 'Tao icon tin nhan se tru 1.5 credits. Dung goi y text va anh logo lam tham chieu. Ban co dong y?'
        : source
          ? 'Tao icon tin nhan se tru 1.5 credits. Chi dung anh logo lam tham chieu. Ban co dong y?'
          : 'Tao icon tin nhan se tru 1.5 credits. Chi dung goi y text. Ban co dong y?'
    if (!window.confirm(confirmMsg)) return
    setLogoBusy(true)
    startTransition(async () => {
      const res = await normalizeMessagingWorkspaceLogo({
        partnerId: selectedPartnerId,
        sourceLogoUrl: source || undefined,
        iconHint: hint || undefined,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        setLogoBusy(false)
        return
      }
      if ('ok' in res && res.ok) {
        toast({
          title: `Da tao icon tin nhan (-${res.deductedCredits} credits). Con lai ${res.creditsRemaining}.`,
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

  const confirmFacebookPendingPage = () => {
    if (!selectedPartnerId || !fbPendingSelectedPageId || fbPagePicking) return
    setFbPagePicking(true)
    void (async () => {
      try {
        const res = await fetch('/api/integrations/facebook/messenger/select-page', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId: selectedPartnerId,
            pageId: fbPendingSelectedPageId,
          }),
        })
        const data = (await res.json().catch(() => null)) as { status?: string; error?: string } | null
        if (!res.ok) {
          toast({ title: data?.error || 'Khong luu duoc Facebook Page da chon.', variant: 'destructive' })
          return
        }
        if (data?.status === 'subscribed-warn') {
          toast({ title: 'Da luu Page token, nhung subscribe webhook chua thanh cong.' })
        } else {
          toast({ title: 'Da ket noi Facebook Page thanh cong.' })
        }
        setFbPagePickerOpen(false)
        setFbPendingPages([])
        setFbPendingSelectedPageId('')
        loadChannelStatus()
      } finally {
        setFbPagePicking(false)
      }
    })()
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

  const updateLoyaltyTier = (idx: number, patch: Partial<LoyaltyTierDraft>) => {
    setLoyaltyTiers((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  const addLoyaltyTier = () => {
    setLoyaltyTiers((rows) => [
      ...rows,
      {
        tierCode: `L${rows.length + 1}`,
        tierName: `L${rows.length + 1}`,
        minSpend6Months: '0',
        discountPercent: '0',
        sortOrder: rows.length,
        isActive: true,
      },
    ])
  }

  const saveLoyaltySettings = () => {
    if (!selectedPartnerId) return
    startTransition(async () => {
      const res = await saveMessagingWorkspaceLoyaltySettings({
        partnerId: selectedPartnerId,
        enabled: loyaltyEnabled,
        spendWindowDays: Math.max(30, Math.min(730, Math.floor(Number(loyaltySpendWindowDays) || 180))),
        maxTotalDiscountPercent: Math.max(0, Math.min(100, Number(loyaltyMaxTotalDiscountPercent) || 0)),
        tiers: loyaltyTiers.map((tier, idx) => ({
          id: tier.id ?? null,
          tierCode: tier.tierCode,
          tierName: tier.tierName,
          minSpend6Months: Math.max(0, Math.round(Number(tier.minSpend6Months) || 0)),
          discountPercent: Math.max(0, Math.min(100, Number(tier.discountPercent) || 0)),
          sortOrder: idx,
          isActive: tier.isActive !== false,
        })),
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Đã lưu cấu hình hạng thành viên.' })
      router.refresh()
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
    if (!selectedPartnerId || !isOwnerSelected || paymentHydratingRef.current) return
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
  }, [isOwnerSelected, paymentSnapshot, persistPaymentSettings, selectedPartnerId])

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
      <Dialog open={fbPagePickerOpen} onOpenChange={setFbPagePickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chon Facebook Page</DialogTitle>
            <DialogDescription>Chon Page ma shop muon nhan tin va dong bo webhook.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Danh sach Page</Label>
            <Select value={fbPendingSelectedPageId || undefined} onValueChange={setFbPendingSelectedPageId}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Chon Facebook Page" />
              </SelectTrigger>
              <SelectContent>
                {fbPendingPages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFbPagePickerOpen(false)
                setFbPendingPages([])
                setFbPendingSelectedPageId('')
              }}
              disabled={fbPagePicking}
            >
              De sau
            </Button>
            <Button type="button" onClick={confirmFacebookPendingPage} disabled={fbPagePicking || !fbPendingSelectedPageId}>
              {fbPagePicking ? 'Dang luu...' : 'Xac nhan Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                  {isOwnerSelected ? (
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
                  ) : (
                    <p className="max-w-[16rem] text-[11px] text-muted-foreground sm:text-xs">{t.teamStaffRestrictedNote}</p>
                  )}
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
                        {p.dashboard_access === 'staff' ? ` — ${t.badgeStaffWorkspace}` : ''}
                        {p.purge_at ? ' — chờ xóa' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPartner?.dashboard_access === 'staff' ? (
                  <p className="text-xs text-muted-foreground">{t.teamStaffRestrictedNote}</p>
                ) : null}
                {isOwnerSelected ? (
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
                ) : null}
              </CardContent>
            </Card>

            {isOwnerSelected && selectedPartnerId ? (
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t.teamStaffSectionTitle}</CardTitle>
                  <CardDescription className="text-xs">{t.teamStaffSectionHint}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-0">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[12rem] flex-1 space-y-1.5">
                      <Label htmlFor="staff-invite-email">{t.teamInviteEmailLabel}</Label>
                      <Input
                        id="staff-invite-email"
                        type="email"
                        autoComplete="email"
                        value={staffInviteEmail}
                        onChange={(e) => setStaffInviteEmail(e.target.value)}
                        placeholder={t.teamInviteEmailPlaceholder}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={inviteStaffByEmailAction}
                      disabled={pending || !staffInviteEmail.trim()}
                      className="shrink-0"
                    >
                      {t.teamInviteButton}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t.teamStaffListTitle}</p>
                    {staffRows.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">—</p>
                    ) : (
                      staffRows.map((sm) => (
                        <div key={sm.id} className="rounded-md border border-border/70 p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="break-all font-mono text-xs">{sm.member_email ?? sm.member_user_id}</p>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeStaffMember(sm.member_user_id)}
                            >
                              {t.teamRemoveMember}
                            </Button>
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {PARTNER_STAFF_PERM_KEYS.map((key) => (
                              <label key={key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={Boolean(staffDraftPerm[sm.member_user_id]?.[key] ?? sm.permissions[key])}
                                  onChange={(e) => toggleStaffDraftPerm(sm.member_user_id, key, e.target.checked)}
                                />
                                <span>{staffPermCheckboxLabel(key)}</span>
                              </label>
                            ))}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-2"
                            onClick={() => saveStaffPermissionsForMember(sm.member_user_id)}
                            disabled={pending}
                          >
                            {t.teamSavePermissions}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

          {isOwnerSelected && showAddWorkspace ? (
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

          {selectedPartnerId && partnerAllowsPerm(selectedPartner, 'workspace_branding') ? (
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
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tao icon tin nhan</CardTitle>
                <CardDescription className="text-xs">
                  Can co it nhat mot trong hai: goi y text hoac anh logo tham chieu. Ca hai deu tuy chon — co mot la
                  du.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="ws-icon-hint">Goi y tao icon (tuy chon)</Label>
                  <Textarea
                    id="ws-icon-hint"
                    value={messagingIconHint}
                    onChange={(e) => setMessagingIconHint(e.target.value)}
                    placeholder="Vi du: icon mau cam, chu 188 noi bat, phong cach hien dai, de doc o kich thuoc nho..."
                    rows={3}
                    className="resize-y text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ws-icon-ref">Anh logo tham chieu (tuy chon)</Label>
                  <Input
                    id="ws-icon-ref"
                    value={messagingIconRefUrl}
                    onChange={(e) => setMessagingIconRefUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      {messagingIconRefUploading ? 'Dang tai anh...' : 'Upload anh tham chieu'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={messagingIconRefUploading || !selectedPartnerId}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.currentTarget.value = ''
                          if (f) void uploadIconRefFile(f)
                        }}
                      />
                    </label>
                    {messagingIconRefUrl.trim() ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={messagingIconRefUrl.trim()}
                        alt=""
                        className="h-10 w-10 rounded border object-contain bg-white"
                      />
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={createMessagingIcon}
                  disabled={
                    pending ||
                    logoBusy ||
                    !selectedPartnerId ||
                    !(messagingIconHint.trim() || messagingIconRefUrl.trim())
                  }
                >
                  {logoBusy ? 'Dang tao icon tin nhan...' : 'Tao icon tin nhan (1.5 credits)'}
                </Button>
                {logoVersions.length > 0 ? (
                  <div className="space-y-2 rounded-md border border-border/70 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Cac phien ban icon tin nhan da tao</p>
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

          {partnerAllowsPerm(selectedPartner, 'integrations_channels') ? (
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
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2.5 text-xs">
                    <p className="mb-2 text-muted-foreground">
                      Ket noi 1 lan de he thong tu luu Page ID + token. Khach chi can cap quyen tren Facebook.
                    </p>
                    <Button asChild type="button" size="sm" disabled={!selectedPartnerId || pending}>
                      <a href={facebookConnectHref}>Ket noi Facebook (OAuth)</a>
                    </Button>
                  </div>
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
          ) : null}

          {partnerAllowsPerm(selectedPartner, 'integrations_analytics') ? (
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
                {!isOwnerSelected ? (
                  <p className="text-[11px] text-muted-foreground">{t.integrationsAnalyticsOwnerOnly}</p>
                ) : null}
                <Button type="button" size="sm" onClick={saveMetaConsult} disabled={pending || !selectedPartnerId || !isOwnerSelected}>
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
                {!isOwnerSelected ? (
                  <p className="text-[11px] text-muted-foreground">{t.integrationsAnalyticsOwnerOnly}</p>
                ) : null}
                <Button type="button" size="sm" onClick={saveShopGa4} disabled={pending || !selectedPartnerId || !isOwnerSelected}>
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
          ) : null}

          {isOwnerSelected ? (
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
          ) : null}

          {isOwnerSelected ? (
          <SettingsBlock
            id="messaging-loyalty"
            icon={Trophy}
            title="Hạng thành viên"
            description="Tính hạng theo chi tiêu của khách trong cửa sổ thời gian và tự động giảm giá khi chốt đơn."
          >
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cấu hình loyalty theo shop</CardTitle>
                <CardDescription className="text-xs">
                  Mặc định L1-L5 theo chi tiêu 6 tháng. Giảm giá được lưu snapshot trên đơn hàng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={loyaltyEnabled}
                    onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                  />
                  Bật hạng thành viên cho shop này
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Số ngày tính chi tiêu</Label>
                    <Input
                      className="h-9 text-sm"
                      value={loyaltySpendWindowDays}
                      onChange={(e) => setLoyaltySpendWindowDays(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                      placeholder="180"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Trần tổng giảm giá (%)</Label>
                    <Input
                      className="h-9 text-sm"
                      value={loyaltyMaxTotalDiscountPercent}
                      onChange={(e) => setLoyaltyMaxTotalDiscountPercent(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))}
                      placeholder="30"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[0.7fr_1fr_1.3fr_1fr_0.6fr] gap-2 text-[11px] font-medium text-muted-foreground">
                    <span>Mã</span>
                    <span>Tên</span>
                    <span>Chi tiêu tối thiểu</span>
                    <span>Giảm (%)</span>
                    <span>Bật</span>
                  </div>
                  {loyaltyTiers.map((tier, idx) => (
                    <div key={tier.id ?? idx} className="grid grid-cols-[0.7fr_1fr_1.3fr_1fr_0.6fr] gap-2">
                      <Input
                        className="h-9 text-sm"
                        value={tier.tierCode}
                        onChange={(e) => updateLoyaltyTier(idx, { tierCode: e.target.value.toUpperCase().slice(0, 24) })}
                      />
                      <Input
                        className="h-9 text-sm"
                        value={tier.tierName}
                        onChange={(e) => updateLoyaltyTier(idx, { tierName: e.target.value.slice(0, 80) })}
                      />
                      <Input
                        className="h-9 text-sm"
                        value={tier.minSpend6Months}
                        onChange={(e) => updateLoyaltyTier(idx, { minSpend6Months: e.target.value.replace(/[^\d]/g, '').slice(0, 14) })}
                      />
                      <Input
                        className="h-9 text-sm"
                        value={tier.discountPercent}
                        onChange={(e) => updateLoyaltyTier(idx, { discountPercent: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })}
                      />
                      <label className="flex h-9 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={tier.isActive}
                          onChange={(e) => updateLoyaltyTier(idx, { isActive: e.target.checked })}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={addLoyaltyTier} disabled={pending || loyaltyLoading}>
                    Thêm hạng
                  </Button>
                  <Button type="button" size="sm" onClick={saveLoyaltySettings} disabled={pending || loyaltyLoading || !selectedPartnerId}>
                    {loyaltyLoading ? 'Đang tải...' : 'Lưu hạng thành viên'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </SettingsBlock>
          ) : null}

          {isOwnerSelected ? (
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
          ) : null}

          {selectedPartnerId && partnerCanAiPanel(selectedPartner) ? (
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
